import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "./api.js";
import {
  getFrozenWriteMessage,
  getLegacyBattleErrorMessage,
  getLegacyShopErrorMessage,
  getLegacyTaskErrorMessage
} from "./legacyErrors.js";

test("getFrozenWriteMessage maps frozen-class writes", () => {
  assert.equal(getFrozenWriteMessage(new ApiError(400, "Class is frozen", null)), "当前班级已冻结，暂不允许执行写操作。");
  assert.equal(getFrozenWriteMessage(new Error("other")), "");
});

test("getLegacyTaskErrorMessage maps legacy task boundary errors", () => {
  assert.equal(getLegacyTaskErrorMessage(new ApiError(400, "Legacy task already claimed", null)), "这项任务已经被领取。");
  assert.equal(getLegacyTaskErrorMessage(new ApiError(400, "Legacy task not started", null)), "任务尚未开始。");
  assert.equal(getLegacyTaskErrorMessage(new ApiError(400, "Legacy task ended", null)), "任务已结束。");
  assert.equal(getLegacyTaskErrorMessage(new ApiError(404, "Legacy task not found", null)), "任务不存在，建议刷新旧功能页后重试。");
  assert.equal(
    getLegacyTaskErrorMessage(new ApiError(404, "Legacy task student not found", null)),
    "领取学生不存在或不是当前班级的 active 学生。"
  );
  assert.equal(
    getLegacyTaskErrorMessage(new ApiError(403, "Legacy feature permission denied", null)),
    "当前账号没有领取旧任务的写权限。"
  );
});

test("getLegacyShopErrorMessage maps redeem, use and gacha boundary errors", () => {
  assert.equal(
    getLegacyShopErrorMessage(new ApiError(400, "Legacy shop balance insufficient", null)),
    "该学生余额不足，无法完成这次藏宝阁操作。"
  );
  assert.equal(getLegacyShopErrorMessage(new ApiError(400, "Legacy shop item out of stock", null)), "这件宝物库存不足。");
  assert.equal(
    getLegacyShopErrorMessage(new ApiError(400, "Legacy shop storage item insufficient", null)),
    "该学生的储物箱里没有这件宝物。"
  );
  assert.equal(
    getLegacyShopErrorMessage(new ApiError(400, "Legacy shop gacha stock insufficient", null)),
    "藏宝阁库存不足，无法完成本次祈愿。"
  );
  assert.equal(
    getLegacyShopErrorMessage(new ApiError(400, "Legacy shop daily usage limit reached", null)),
    "这件宝物今天已达到全班使用上限。"
  );
  assert.equal(
    getLegacyShopErrorMessage(new ApiError(403, "Legacy feature permission denied", null)),
    "当前账号没有旧功能写权限。"
  );
});

test("getLegacyBattleErrorMessage maps settlement boundary errors", () => {
  assert.equal(getLegacyBattleErrorMessage(new ApiError(404, "Legacy battle not found", null)), "当前班级还没有双子星兼容数据。");
  assert.equal(
    getLegacyBattleErrorMessage(new ApiError(400, "Legacy battle exams not configured", null)),
    "请先在双子星区域选择组队基准考试和结算考试。"
  );
  assert.equal(
    getLegacyBattleErrorMessage(new ApiError(400, "Legacy battle has no pending matches", null)),
    "当前没有待结算的双子星挑战。"
  );
  assert.equal(
    getLegacyBattleErrorMessage(new ApiError(400, "Legacy battle exam not found", null)),
    "双子星考试数据不存在，建议先检查兼容考试列表。"
  );
  assert.equal(
    getLegacyBattleErrorMessage(new ApiError(403, "Legacy feature permission denied", null)),
    "当前账号没有双子星结算写权限。"
  );
});
