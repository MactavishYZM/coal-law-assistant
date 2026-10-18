# 煤矿法规标准智能检索（防冲专题）

网站：https://mactavishyzm.github.io/coal-law-assistant/

## 2026-10-18 文字与公式校正

- 从PDF文字层恢复可提取的正文，修复标准英文术语的字体编码，并对119页编码损坏的标准按实际行位置重新识别。
- 将《2026防治煤矿冲击地压细则》文字与高清扫描页对应，补回此前遗漏的第1—41条。
- 公式直接由原PDF页面提取为PNG，保留原有分式、上下标、希腊字母、运算符号及符号说明；公式不使用OCR排版。
- 表格按原文图像显示，避免把单元格内容误分为条款。检索结果可展开正文、查看原文整页并打开对应PDF。

## 文件

`index.html`包含离线检索数据；`index-data.json`是相同数据的独立副本。`assets/corrected-app.js`与`assets/corrected-text.css`提供界面；`formulae/`保存原文公式图，`pages/`保存583页原文图，`source/`保存24份PDF。

本地使用时保留完整目录，可在目录内运行`python -m http.server 8080`。修改后可通过附带的PowerShell脚本更新原GitHub仓库。
