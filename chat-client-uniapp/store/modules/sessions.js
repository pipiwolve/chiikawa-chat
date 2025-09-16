import {fetchSessions} from "../../utils/socket.js";

const state = {
    list: [],
    lastUpdate: 0
}

const mutations = {
    SET_LIST(state, arr) {
        state.list = arr
        state.lastUpdate = Date.now()
    }
}

const actions = {
    async loadList({ commit, state }, { userId, force = false } = {}) {
        if (!force && Date.now() - state.lastUpdate < 5 * 60 * 1000) return
        const res = await new Promise(resolve => fetchSessions(resolve))
        commit('SET_LIST', (res.sessions || []).map(s => ({
            ...s,
            hasUnread: (s.unread || 0) > 0 || (s.pendingFriendRequest || false)
        })))
    }
}

export default { namespaced: true, state, mutations, actions }