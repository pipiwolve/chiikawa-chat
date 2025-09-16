import { createStore } from 'vuex'
import friends from './modules/friends'
import groups from './modules/groups'
import groupRequests from './modules/groupRequests'
import sessions from './modules/sessions'
import friendRequests from  './modules/friendRequests'
export default createStore({
    modules: { friends, groups, groupRequests, sessions, friendRequests }
})