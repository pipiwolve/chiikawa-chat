"use strict";
function handleAuthResponse(msg, onSuccess, onFail) {
  if (!msg || !msg.result) {
    onFail && onFail("未知错误");
    return;
  }
  if (msg.result === "ok") {
    const nickname = msg.nickname || msg.fromUser || "";
    onSuccess && onSuccess(nickname);
  } else {
    onFail && onFail("操作失败");
  }
}
exports.handleAuthResponse = handleAuthResponse;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/auth.js.map
