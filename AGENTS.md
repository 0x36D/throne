# AGENTS.md

本文件约束所有在本仓库工作的编码代理。`docs/` 是唯一事实来源，代码服从文档。

## 三条硬约束

1. **根因优先。** 任何 BUG 必须先写清根因（触发条件、数据流、为什么现有校验没拦住），禁止只改表象或"先让它不报错"。根因未确认前不得提交修复。
2. **禁止兜底。** 不允许静默降级，包括但不限于：
   - `try/catch` 吞异常或只置布尔标记；
   - 用 `??` / `||` / 默认值掩盖缺失数据；
   - `switch` 的 `default` 静默放过未知输入；
   - 宽松解析畸形数据（去围栏、扫描括号、类型强制转换）；
   - 缺少凭据、指令或配置时回退到隐式默认值。
   
   未定义输入必须在边界**显式失败**（抛错并给出可定位信息）。
3. **文档先行。** 改动前先在 [docs/issues](./docs/issues/README.md) 登记：现象、根因、影响面、是否涉及兜底、方案、验证方式，评估通过后才实现。

## 工作流

1. 读 [docs/SPEC.md](./docs/SPEC.md)、[docs/DESIGN.md](./docs/DESIGN.md)、[docs/architecture/overview.md](./docs/architecture/overview.md)、[STATUS.md](./STATUS.md)。
2. 在 `docs/issues/BUGS.md` 或 `docs/issues/FEATURES.md` 落盘条目（根因未明则状态保持"登记"）。
3. 确认根因并评估方案（涉及架构边界时补 `docs/architecture/NNNN-*.md`）。
4. 实现；不得绕过事件调度、事务校验与事件溯源。
5. 跑验证命令，通过后在条目中记录结果并推进状态。

## 验证命令

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

## 代码约定

- 纯 ESM，导入带 `.ts` 后缀；TS 严格模式（`strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`）。
- 数据保持 `readonly`，状态更新用展开式；跨边界用 `structuredClone`。
- 模拟时间只用 `SimTime`；事件 payload 收敛到 `JsonObject` / `JsonValue`。
- 事件类型统一为 `namespace.action` 字符串。
- 模拟规则只进 `sim-core` 与 `scenario-mvp`；agent 代码可返回结构化决策，但不得直接改写世界状态。
- 不写代码注释，设计信息写入 `docs/`。
- 测试与被测文件同目录，命名为 `*.test.ts`。
