# FEATURES

登记新增能力与机制。模板与约束见 [README.md](./README.md)。

## 登记册

| ID | 标题 | 状态 | 关联 |
| --- | --- | --- | --- |
| FEAT-0001 | 播放路径内接入一次真实 DeepSeek NPC 决策 | 登记 | STATUS 下一切片 |
| FEAT-0002 | 场景事件类型穷尽化，消除 reduce 静默分支 | 登记 | BUG-0003 |
| FEAT-0003 | 事件 payload 边界 schema 校验 | 登记 | BUG-0004 |
| FEAT-0004 | 任命层：Office / AppointmentRecord / 派生权威 | 待评估 | ADR 0003 |

---

### FEAT-0001 播放路径内接入一次真实 DeepSeek NPC 决策

- 状态：登记
- 动机：验证结构化 LLM 决策能进入可玩回路，且回放不再触发模型调用。
- 当前差距：播放场景目前使用 `HumanDecisionPolicy`；Harness 路径仅由 Demo F 的结构边界覆盖，默认走记录策略。
- 影响面：`packages/agent-runtime`、`packages/scenario-mvp`、`apps/web`。
- 方案：待评估（决策落库字段、trace 记录边界、回放断言）。
- 验证：新场景测试断言"回放不产生新的模型调用"。

### FEAT-0002 场景事件类型穷尽化，消除 reduce 静默分支

- 状态：登记
- 动机：让编译器强制每个场景处理其全部事件类型，杜绝漏投影。
- 当前差距：`DomainEvent` 的 `eventType` 为宽 `string`，`reduce` 留有静默默认分支。
- 影响面：`packages/shared-types`、全部 `packages/scenario-mvp/src/*.ts`。
- 方案：待评估（是否引入按场景收窄的事件联合类型）。
- 验证：移除默认分支后 `pnpm typecheck` 仍通过，且未知事件测试抛错。

### FEAT-0003 事件 payload 边界 schema 校验

- 状态：登记
- 动机：让事件读取在边界显式失败，而非降级为空值。
- 当前差距：`stringArray` / `objectValue` 等宽转换函数散布于各场景。
- 影响面：`packages/shared-types`、`packages/sim-core`、`packages/scenario-mvp`。
- 方案：待评估（事件 schema 定义位置与调用点）。
- 验证：畸形 payload 测试抛错；`pnpm test`。

### FEAT-0004 任命层：Office / AppointmentRecord / 派生权威

- 状态：待评估
- 设计：`docs/architecture/0003-appointment-layer.md`（ADR，状态 proposed）
- 动机：让"合法性"与"实际控制"分离，使将军升丞相仍握旧部、外戚掌财政军权、争议任命等结构涌现。
- 四项决议：职位用关系/权力声明；`formalAuthorityIds` 派生；合法性为可改写快照；允许争议并存。
- 当前差距：无 `Office` 实体、无任命操作、`formalAuthorityIds` 为手写、无命令成本。
- 影响面：`packages/shared-types`、`packages/sim-core`、`packages/scenario-mvp`、`apps/web`（管理员视图）。
- 方案：按 ADR 0003 实现最小切片（升迁场景 + 双派生函数 + 断言），不在本切片引入经济与命令成本。
- 验证：任命不改动任何关系强度；移除不删除履历；回放不调模型；非法转移显式抛错；争议并存不合并。
- 备注：本项扩大 MVP 范围，触碰 SPEC §2/§6/§7/§10/§14.1/§19，需在设计评审通过后再实现。
