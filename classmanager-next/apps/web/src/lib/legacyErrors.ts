import { ApiError } from "./api";

export function getFrozenWriteMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 400 && error.message.includes("Class is frozen")) {
    return "当前班级已冻结，暂不允许执行写操作。";
  }
  return "";
}

export function getLegacyTaskErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "";
  }

  if (error.status === 400 && error.message.includes("Legacy task already claimed")) {
    return "这项任务已经被领取。";
  }
  if (error.status === 400 && error.message.includes("Legacy task not started")) {
    return "任务尚未开始。";
  }
  if (error.status === 400 && error.message.includes("Legacy task ended")) {
    return "任务已结束。";
  }
  if (error.status === 404 && error.message.includes("Legacy task not found")) {
    return "任务不存在，建议刷新旧功能页后重试。";
  }
  if (error.status === 404 && error.message.includes("Legacy task student not found")) {
    return "领取学生不存在或不是当前班级的 active 学生。";
  }
  if (error.status === 403 && error.message.includes("Legacy feature permission")) {
    return "当前账号没有领取旧任务的写权限。";
  }

  return "";
}

export function getLegacyShopErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "";
  }

  if (error.status === 400 && error.message.includes("Legacy shop balance insufficient")) {
    return "该学生余额不足，无法完成这次藏宝阁操作。";
  }
  if (error.status === 400 && error.message.includes("Legacy shop item out of stock")) {
    return "这件宝物库存不足。";
  }
  if (error.status === 400 && error.message.includes("Legacy shop storage item insufficient")) {
    return "该学生的储物箱里没有这件宝物。";
  }
  if (error.status === 400 && error.message.includes("Legacy shop gacha stock insufficient")) {
    return "藏宝阁库存不足，无法完成本次祈愿。";
  }
  if (error.status === 400 && error.message.includes("Legacy shop daily usage limit reached")) {
    return "这件宝物今天已达到全班使用上限。";
  }
  if (error.status === 400 && error.message.includes("Negative price item requires negative balance")) {
    return "负价格宝物只能在余额小于 0 时兑换。";
  }
  if (error.status === 400 && error.message.includes("Negative price item cannot push balance above zero")) {
    return "负价格宝物兑换后余额不能大于 0。";
  }
  if (error.status === 404 && error.message.includes("Legacy shop item not found")) {
    return "目标宝物不存在，建议刷新旧功能页后重试。";
  }
  if (error.status === 404 && error.message.includes("Legacy shop student not found")) {
    return "目标学生不存在或不是当前班级的 active 学生。";
  }
  if (error.status === 403 && error.message.includes("Legacy feature permission")) {
    return "当前账号没有旧功能写权限。";
  }

  return "";
}

export function getLegacyBattleErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "";
  }

  if (error.status === 404 && error.message.includes("Legacy battle not found")) {
    return "当前班级还没有双子星兼容数据。";
  }
  if (error.status === 400 && error.message.includes("Legacy battle exams not configured")) {
    return "请先在双子星区域选择组队基准考试和结算考试。";
  }
  if (error.status === 400 && error.message.includes("Legacy battle has no pending matches")) {
    return "当前没有待结算的双子星挑战。";
  }
  if (error.status === 400 && error.message.includes("Legacy battle exam not found")) {
    return "双子星考试数据不存在，建议先检查兼容考试列表。";
  }
  if (error.status === 403 && error.message.includes("Legacy feature permission")) {
    return "当前账号没有双子星结算写权限。";
  }

  return "";
}
