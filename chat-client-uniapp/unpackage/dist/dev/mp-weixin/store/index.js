"use strict";
const common_vendor = require("../common/vendor.js");
const store_modules_friends = require("./modules/friends.js");
const store_modules_groups = require("./modules/groups.js");
const store_modules_groupRequests = require("./modules/groupRequests.js");
const store_modules_sessions = require("./modules/sessions.js");
const store_modules_friendRequests = require("./modules/friendRequests.js");
const store = common_vendor.createStore({
  modules: { friends: store_modules_friends.friends, groups: store_modules_groups.groups, groupRequests: store_modules_groupRequests.groupRequests, sessions: store_modules_sessions.sessions, friendRequests: store_modules_friendRequests.friendRequests }
});
exports.store = store;
//# sourceMappingURL=../../.sourcemap/mp-weixin/store/index.js.map
