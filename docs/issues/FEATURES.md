# 当前功能

当前无已开工功能。FEAT-0005 已完成：[连续决策短局及两局实玩](archive/continuous-crisis.md)。现行规则见 [ADR 0005](../architecture/0005-continuous-crisis.md)。

FEAT-0001 已完成，见 [归档](archive/live-npc.md) 与 [首次实玩](archive/live-playtest-2026-09-21.md)。

FEAT-0004 已完成，结果见 [归档](archive/appointments.md)；现行规则仍在 [ADR 0003](../architecture/0003-appointment-layer.md)，开发任命机制时按需读取。

原 FEAT-0002 / 0003 并入可靠性修复，不单独扩大为全项目类型系统重构。

## 待评估（proposed ADR）

- FEAT-0006 资源与财政层，设计见 [ADR 0002](../architecture/0002-resource-and-fiscal-layer.md)。前置：无。
- FEAT-0007 问责与有据罢免，设计见 [ADR 0006](../architecture/0006-accountability-and-removal.md)。前置：FEAT-0006、任命层（已完成）。
- FEAT-0008 角色与关系契约 v2，设计见 [ADR 0007](../architecture/0007-actor-and-relationship-contract.md)。前置：无。
- FEAT-0009 党争路线与变法平衡，设计见 [ADR 0008](../architecture/0008-factional-reform-and-balance.md)。前置：FEAT-0006、0007、0008。
- FEAT-0010 恩庇与腐败网络（多级贿赂 / 利益输送 / 结党营私），设计见 [ADR 0009](../architecture/0009-patronage-and-corruption-networks.md)。前置：FEAT-0006、0007、0009。

以上均扩大 SPEC 范围（§7/§21/§26），需设计评审通过后再实现。

## 实现进展（fork 最小切片）

以下为在 fork 中按 ADR 落地的可运行最小切片，尚未合入上游，也未迁移既有场景：

- FEAT-0006 资源与财政层：`packages/shared-types/src/resources.ts` + `packages/scenario-mvp/src/fiscal.ts`（账户、流量、上报/审计分离、守恒与非负校验）。
- FEAT-0007 问责与有据罢免：`packages/shared-types/src/accountability.ts` + `packages/scenario-mvp/src/accountability.ts`（finding、证据强度、`deriveResistanceToRemoval`，有据罢免抵抗低于随意罢免）。
- FEAT-0008 角色与关系契约 v2：`packages/shared-types/src/actor-contract.ts`（`MotivationProfile`、十一类关系 + valence、派生立场）；既有 `PersistentActor` 暂未替换。
- FEAT-0009 党争路线与变法平衡：`packages/scenario-mvp/src/faction-reform.ts`（政策/规则/派生支持与抵抗）+ `packages/scenario-mvp/src/court.ts`（契约 v2 + 财政 + 问责 + 派系集成）。

### 贿赂与 AI 决策边界（7 项改动）

- 契约：`BribeOfferView` 只含角色可见事实（金额、对象、自身动机、关系、可选检测提示），引擎不再下发算好的 benefit/risk。
- 策略：`packages/agent-runtime/src/bribe-policy.ts`（`HeuristicBribePolicy`、`RecordedBribePolicy`、`HarnessBribePolicy` + `assertActorInstructions`、结构化激励系统提示）。
- 复现/失败：`RecordedBribePolicy` 缺失记录即抛错；harness 失败不回落默认（无兜底）。
- 供应商探针：`docs/providers.md` 规则 7。
- 对照夹具：`packages/scenario-mvp/src/bribe-comparison.ts`（同局对比清廉/腐败审计官）。
- 统一行动空间：`packages/agent-runtime/src/actor-action.ts` + `packages/scenario-mvp/src/strategy-court.ts`（官员在 lobby/bribe/report/obey/defect 中自行选择，`canAttempt` 校验）。
- 集成：`grand-court.ts` 接入贿赂（收买审计官 → 洗白审计 / 压案 / 罢免降级）。

验证：`pnpm test`（27 文件 / 116 测试）、`pnpm typecheck`、`pnpm build` 均通过。
