# Nodus 渲染升級計畫（P2：SVG → Canvas）

> 狀態（2026-06-12 更新）：**app 頁已完成 Canvas 化**（分支 `feat/p2-canvas-renderer`，
> 步驟 1–6 全數執行完畢，11 E2E + 3 視覺 oracle 通過，真實 GPU ~100fps）。
> 剩餘：步驟 7（explorer 套用同一 renderer）——explorer 目前仍為 SVG，正常運作。
>
> 實作落點：`src/engine/star-sprites.js`（離屏星體 sprite）+
> `src/engine/canvas-renderer.js`（場景繪製器，已含 Deep Field：層級/焦點調暗/
> 漸層曲線/大氣層/標籤防碰撞/超級 hub 克制）+ `app-main.js`（vis 旗標 + 指標互動）
> + `src/engine/layout.js`（共用力導向，build 時預烘焙座標）+ `theme.js`（design tokens）。
> 實戰教訓：(1) 每幀對數十條曲線開 `shadowBlur` 會把 Chrome 光柵壓到 2fps——
> 光暈一律用「寬+窄雙筆畫」疊出；(2) 加色合成在遠距縮放會把重疊星體疊爆成白團——
> 需要隨 k 縮小的曝光控制；(3) 首幀必須同步繪製，rAF 在隱藏分頁不觸發。
>
> ## 步驟 7（explorer 移植）執行藍圖 — 2026-06-12 盤點
>
> explorer 與 app 的差異在「漸進展開」：`rebuildVisuals()`（explorer-main.js:1221）
> 對 **可見子集** `visibleNodes`/`visibleEdges` 做 d3 data-join（enter/merge），
> `tick()`（:1180）更新位置。移植步驟：
> 1. **資料集介面**：canvas-renderer 目前在建立時鎖定 `nodes`/`edges` 參考。explorer
>    每次展開會 `visibleNodes = Array.from(...)`（換新陣列）。需給 renderer 加
>    `setData(nodes, edges)`，或改 explorer 就地 mutate 同一陣列。前者較乾淨。
> 2. **vis 旗標接線**：把 explorer 的 selected/highlight/dimmed/prereq 狀態從 CSS class
>    改成 node.vis/edge.vis（與 app 同一套語意），刪除 SVG defs/node-creation/tick DOM 寫入。
> 3. **explorer 專屬視覺**需在 canvas 補：expand ring（hover 顯示鄰居數）、neighbor badge、
>    node-entrance 動畫（新展開節點淡入放大）；DOM overlay（context menu、link tooltip、
>    recommendation panel）改讀 renderer 的螢幕座標即可，不需重畫。
> 4. **E2E 重寫**：explorer 的 `startExploration`/`g` hook 與 SVG 斷言（`g.node`、`circle.core`、
>    focus-glow）改成 app 那套引擎狀態 hook（仿 `window.__nodusApp`）+ 像素取樣。
> 5. **共用 layout**：explorer 也可用 `layout.js`，但它是子集動態模擬，預烘焙意義不大；
>    保留即時模擬即可。
> 6. 順手清「三套粒子實作」最後一份（explorer 的 `initParticles`）。
>
> 風險：explorer 線上正常運作，半成品不可合進自動部署的 master——須在分支完成並
> 經人工視覺驗收（如 app 港口）後才合併。規模與 app 港口相當（非小修）。
>
> 以下原始藍圖保留作歷史脈絡與 explorer 移植時的參考。

## 為什麼暫緩

把 app／explorer 兩套引擎從 **SVG + CSS** 改成 **Canvas 2D** 是真正的「渲染升級」，
但它**無法在「確保不出錯誤」的前提下自主、不可驗證地完成**，理由：

1. **整套視覺狀態系統綁在 CSS class 上**——`highlight`／`dimmed`／`selected-node`／
   `learned`／`available`／`on-path`／`prereq-path`／`focus-ring`／`photon`／`twinkle`
   目前全是 CSS（`shared.css`、`styles/components/nodes.css`、`edges.css`、`keyframes.css`）。
   Canvas 沒有 class，必須把這整套狀態改寫成每幀 imperative 繪製。
2. **所有現有 E2E 斷言 SVG DOM**：`g.node`、`circle.core`、`circle.hit`、
   `.link.focus-curve.active`、`.photon`、`.focus-ring`。Canvas 化後這些選擇器全部失效，
   `focus-glow`／`smoke`（drag）／`descriptions` 測試都要重寫成「讀取暴露的 JS 狀態」或
   「像素取樣」——這是測試策略的重新設計，不是小修。
3. **視覺等價無法自動驗證**：twinkle／photon 是連續動畫，截圖 pixel-diff 不穩定，只能靠人眼逐項驗收。
   對一個「初級程式 + 單人 + 無法自行除錯」的擁有者，自主送出未經人工驗收的 canvas 引擎是不負責任的。
4. **現況不是瓶頸**：627 節點 / 3004 邊在現有**已高度優化**的 SVG 引擎上順跑
   （視口剔除、perf-mode 自動降級、RAF 節流 tick、edge path 快取、zoom 反向縮放）。
   升級是為了**視覺天花板**（真加色發光 additive blending、更順的環境動畫、未來節點數成長），
   不是為了解決當前卡頓。

**結論**：這是使用者已預先授權「太困難可暫緩並註記」的部分。應作為一次**獨立、有人工視覺驗收**的
工作來做，而非無回報的自主批次。

## 已為此鋪好的路（P1 成果）

- 兩個引擎都已是 **ES module**（`app-main.js`、`explorer-main.js`），可自由 `import`。
- 共用 `src/engine/geometry.js` 已建立（`hexA`、`edgeCurveDirection`、`curvedEdgePath`）——
  canvas 版的邊幾何可直接沿用。
- D3 已是 tree-shaken 的 npm 模組，`d3-quadtree`（hit-testing 需要）已隨 `d3` 一併可用。
- 資料層（topology / descriptions 分離、非阻塞 streaming）已就緒，與渲染解耦。

## 建議架構

保留 **D3-force 做物理**，只換**渲染層**。目標：單一 `<canvas>` 取代 `<svg id="canvas">`。

```
src/engine/
  geometry.js        ← 已完成（邊曲線、色彩）
  star-sprites.js    ← 新：離屏預繪 core/glow/halo/corona（每 domain × tier 一張 sprite）
  renderer.js        ← 新：draw(ctx, transform, state) 每幀重繪；'lighter' 加色合成
  picker.js          ← 新：d3.quadtree 包裝，pointer → node 命中測試
  interactions.js    ← 新：d3.zoom / d3.drag 綁在 canvas 上，回拋事件
```

App 與 explorer 各保留一層薄 adapter：自己管理 node/edge 集合、面板、搜尋、i18n、LP/探索語意，
只把「畫什麼」交給 `renderer.js`。

## 逐步執行（建議順序，每步可獨立驗收）

1. **star-sprites.js**：把現有 `starStops`（core/glow/halo/corona 漸層）改成在離屏 canvas 上
   `createRadialGradient` 預繪成點陣 sprite。先寫一個 demo 頁，肉眼比對與 SVG 版發光是否一致。
2. **renderer.js（只畫，不互動）**：在 app 頁**並排**加一個隱藏 canvas，每幀畫出與 SVG 相同的
   節點＋邊，用 `globalCompositeOperation='lighter'` 做加色發光。與 SVG 版疊圖比對，調到視覺接近。
3. **互動移植**：`d3.zoom`／`d3.drag` 綁 canvas，`d3.quadtree` 做 hit-test（drag / click / hover）。
4. **狀態繪製**：把 highlight／dim／selected／focus-ring／LP 狀態從 CSS class 改成 renderer 讀旗標繪製。
   photon 流光 = 沿 `curvedEdgePath` 的動畫 dash offset；twinkle = 每星 alpha 振盪（sim 停止後仍跑）。
5. **切換**：移除 `<svg>`、改用 canvas；刪除已死的 CSS（`nodes.css`／`edges.css` 的星體樣式、
   `keyframes.css` 的 twinkle/photon）與已不需要的補救程式（視口剔除、perf-mode、counter-scale、
   edge path 快取——canvas 全量重繪 627+3004 在任何現代裝置都 < 16ms）。
6. **測試重寫**：E2E 改為（a）暴露 `window.__nodus = { hitTest, getState }` 供 drag/click 斷言；
   （b）關鍵畫面用 Playwright canvas 截圖 + 容差比對。先補測試，再切換，避免裸奔。
7. **explorer 套用**：app 穩定後，explorer 共用同一 `renderer.js`，只接自己的 adapter。

## 不建議 WebGL（現階段）

627 節點用 WebGL 是過度工程：shader 由 AI 生成後擁有者更難驗證、除錯成本高，
而 Canvas 2D + offscreen sprite + `lighter` 合成在 10 倍節點量內都夠用。
若未來節點破萬再評估 Pixi.js / regl。

## 風險與緩解

| 風險 | 緩解 |
|------|------|
| 視覺不等價 | 步驟 2 並排疊圖逐項調；保留 SVG 版於 git 可隨時對照 |
| 互動回歸 | 步驟 6 先補「暴露狀態」型 E2E 再切換 |
| 一次太大 | 嚴格照步驟 1→7，每步可獨立 merge/回退；app 先於 explorer |
| 擁有者無法除錯 | 全程人工視覺驗收（Claude Preview 截圖），不自主裸送 |
