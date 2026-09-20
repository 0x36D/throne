# BUGS

登记与设计意图不符的行为。根因未确认前不实现修复。模板与约束见 [README.md](./README.md)。

## 登记册

| ID | 标题 | 是否兜底 | 状态 | 位置 |
| --- | --- | --- | --- | --- |
| BUG-0001 | 本地化缺中文键时回退英文 | 是 | 登记 | packages/localization/src/index.ts:26 |
| BUG-0002 | 翻译令牌缺失键时静默造词 | 是 | 登记 | packages/localization/src/index.ts:36 |
| BUG-0003 | 场景 reduce 默认分支静默放过未知事件 | 是 | 根因确认 | packages/scenario-mvp/src/*.ts（7 处） |
| BUG-0004 | 事件 payload 解析静默降级为空值 | 是 | 登记 | packages/scenario-mvp/src/*.ts |
| BUG-0005 | Harness 响应宽松解析 | 是 | 登记 | packages/agent-runtime/src/deepseek-harness.ts:98 |
| BUG-0006 | Web 端错误被吞、仅置布尔标记 | 是 | 登记 | apps/web/src/main.tsx:105,129 |

---

### BUG-0001 本地化缺中文键时回退英文

- 状态：登记
- 是否兜底：是
- 位置：`packages/localization/src/index.ts:26`
- 现象：`createTranslator` 取模板时 `catalogs[locale][key] ?? en[key]`，中文目录缺键会静默用英文。
- 根因：待确认。`catalogs` 与 `zhCN` 的类型标注为 `Record<MessageKey, string>`，理论上键齐全，回退分支可能永远不可达；需确认是否只是掩盖类型断言的漏洞。
- 影响面：若不可达，是死兜底，应删除并让类型系统承担保证；若可达，说明存在类型未覆盖的键。
- 方案：待根因确认后制定（删除回退 vs 补齐键定义）。
- 验证：`pnpm typecheck` + `packages/localization/src/index.test.ts`。

### BUG-0002 翻译令牌缺失键时静默造词

- 状态：登记
- 是否兜底：是
- 位置：`packages/localization/src/index.ts:36`
- 现象：`translateToken` 对不存在于 `en` 的键执行 `value.replaceAll("_", " ")`，把标识符当显示文案。
- 根因：待确认。设计上模拟标识符应为语言中立、由目录显式映射，静默人化会掩盖未登记的令牌。
- 影响面：界面可能显示未翻译的原始 token；问题不会在测试中暴露。
- 方案：待根因确认（改为显式失败或强制登记）。
- 验证：`packages/localization/src/index.test.ts`。

### BUG-0003 场景 reduce 默认分支静默放过未知事件

- 状态：根因确认
- 上游 issue：https://github.com/unryuu/throne/issues/1
- 是否兜底：是
- 位置（`reduce` 的 `default`）：
  - `packages/scenario-mvp/src/player-decision.ts:611`（`return state as PlayerDecisionState`）
  - `packages/scenario-mvp/src/loss-of-control.ts:918`
  - `packages/scenario-mvp/src/false-report.ts:415`
  - `packages/scenario-mvp/src/contradictory-orders.ts:698`
  - `packages/scenario-mvp/src/decision-revision.ts:620`
  - `packages/scenario-mvp/src/dynamic-promotion.ts:689`
  - `packages/scenario-mvp/src/partial-implementation.ts:625`
- 现象：7 个场景的 `reduce` 对未知 `eventType` 静默 `return state`；同一文件的 `resolveBatch` 对未知事件却是 `throw`。
- 根因：`DomainEvent.eventType` 与 `DomainEventDraft.eventType` 的类型是开放 `string`（`packages/shared-types/src/events.ts:15,24`、`packages/sim-core/src/kernel.ts:14,22`），`resolveBatch` 的产出与 `reduce` 的输入之间没有闭合联合类型约束，编译器无法做穷尽性检查，故每个 `reduce` 的 `default` 成为静默吸收点。内核 `step()` 只对本次 `resolveBatch` 刚产出的 committed 事件做投影（`kernel.ts:120-123`），因此"已发出但 reduce 未处理"的事件会被写入日志却不改变状态；`replay` 走同一 `reduce`，同样跳过（`replay.ts:10-13`），日志与重建状态静默分叉。
- 已确认的真实缺口（对 7 个场景逐文件比对 committed 输出 vs `reduce` 的 `case`）：
  - `contradictory-orders.ts:541` 发出 `operation.failed`，`reduce` 无对应分支。触发条件为目标地点不在 `unit.accessibleLocationIds`（`:539`）。当前场景两目标 `palace`/`granary` 均在可达集合内（`:236,750,764`），故**当前数据不可达**，属潜伏缺陷。
  - `dynamic-promotion.ts:478` 发出 `artifact.disposition_recorded`，`reduce` 无对应分支。触发条件为策略选择 `share_evidence_with_chancellor` 或 `conceal_evidence`（`availableCapabilities` 三项之二，`:131-135`），是场景刻意保留的策略扩展点。
- 复现证据（未改仓库；临时脚本 `%TEMP%\opencode\probe-0003.mts`，以选择 `conceal_evidence` 的 `PromotionDecisionPolicy` 跑 `runDynamicPromotionScenario`）：
  - committed 事件序列含 `artifact.disposition_recorded` ×1；
  - 结果 `state.artifacts[ledger].disclosedToIds` 仍为 `[]`，`holderId` 未变 → 事件已入日志，状态未投影。
- 影响面：扩展决策即可导致状态与事件日志静默不一致。下一切片（在播放路径接入真实 LLM NPC 决策）会走到 non-disclosure 分支，必然命中。
- 方案（待评估，本次不实现）：为每个场景定义闭合事件类型联合，使 `resolveBatch` 只能产出该联合、`reduce` 对其穷尽 `switch` 并删除静默 `default`；或在 `validate` 中强制本次所有 committed 事件类型均被处理。
- 验证：为上述两处补"发出即投影"测试；补"未知事件必须抛错"测试；`pnpm typecheck`、`pnpm test`。

### BUG-0004 事件 payload 解析静默降级为空值

- 状态：登记
- 是否兜底：是
- 位置（示例，散布于各场景文件）：
  - `packages/scenario-mvp/src/player-decision.ts:896`（`stringArray`）、`:901`（`objectValue`）
  - `packages/scenario-mvp/src/loss-of-control.ts:1573`（`stringArray`）、`:1577`（`objectValue`）
- 现象：对畸形或缺失的 payload 字段返回 `[]` / `{}`，而不是失败。
- 根因：待确认。事件 payload 类型为通用 `JsonObject`，读取时用宽转换函数代替 schema 校验。
- 影响面：损坏的模拟记录会以空值继续流转，掩盖真实的提交错误。
- 方案：待根因确认（在事件读取边界做 schema 校验并显式失败）。
- 验证：构造畸形 payload 的测试应抛错。

### BUG-0005 Harness 响应宽松解析

- 状态：登记
- 是否兜底：是
- 位置：`packages/agent-runtime/src/deepseek-harness.ts:98-114`（`parseDecisionResponse`）
- 现象：先剥离 ``` 围栏，再扫描首尾花括号截取 JSON，随后交给 zod。
- 根因：待确认。可能是为兼容模型偶发的 Markdown 包裹；需确认这是契约内允许的格式还是对模型不守格式的兜底。
- 影响面：若模型返回多余文本，会被静默接受，掩盖提示/契约问题。
- 方案：待根因确认（明确响应契约为纯 JSON，去围栏逻辑移入契约或删除）。
- 验证：`packages/agent-runtime/src/deepseek-harness.test.ts` 增补非法响应用例。

### BUG-0006 Web 端错误被吞、仅置布尔标记

- 状态：登记
- 是否兜底：是
- 位置：`apps/web/src/main.tsx:105`、`:129`
- 现象：`.catch(() => { setPlayerError(true) })` 丢弃错误对象与堆栈，界面只显示通用文案。
- 根因：待确认。需要区分"玩家可恢复的交互失败"与"内部不变量被破坏"。
- 影响面：真实故障无法定位；与禁止兜底冲突。
- 方案：待根因确认（保留错误内容用于调试视图；不变量错误应显式暴露）。
- 验证：构建通过 + 手工复现失败路径能显示具体原因。
