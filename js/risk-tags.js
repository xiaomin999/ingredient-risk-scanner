/*
 * 风险标识体系 (Risk Tag Taxonomy)
 * 每条被识别出的成分，除「高/中/低」风险等级外，再归到一种「危害性质」标识。
 * 用途：在识别结果 / 拍照记录中，用统一的图标 + 颜色徽章直观展示「有哪些类型的危害」。
 *
 * window.RISK_TAGS   标识定义（顺序即展示顺序）：id -> {label, icon, color, desc}
 * window.RISK_TAG_MAP 成分 id -> 该成分归属的标识 id 数组（可 1~2 个）
 */
window.RISK_TAGS = {
  illegal:     { label: "非法添加", icon: "🚫", color: "#e53935", desc: "法规明令禁止用于该品类，属违法添加物。" },
  carcinogen:  { label: "致癌风险", icon: "☢️", color: "#c2185b", desc: "WHO/IARC 等权威机构列为致癌或疑似致癌物。" },
  hormone:     { label: "激素干扰", icon: "💉", color: "#9c27b0", desc: "糖皮质激素 / 环境雌激素，干扰内分泌系统。" },
  heavyMetal:  { label: "重金属",   icon: "⚠️", color: "#455a64", desc: "汞、铅、砷等，可在体内长期蓄积中毒。" },
  metabolic:   { label: "代谢负担", icon: "🫀", color: "#1565c0", desc: "反式脂肪 / 添加糖 / 钠等，损害心脑与代谢。" },
  colorant:    { label: "人工色素", icon: "🎨", color: "#00897b", desc: "人工合成着色剂，儿童等人群宜控量。" },
  sweetener:   { label: "甜味剂",   icon: "🍬", color: "#d81b60", desc: "人工甜味剂，长期高摄入存在争议。" },
  preservative:{ label: "防腐风险", icon: "🧪", color: "#ef6c00", desc: "防腐剂 / 甲醛释放体，部分易致敏或限量。" },
  irritant:    { label: "刺激致敏", icon: "🔥", color: "#f9a825", desc: "刺激皮肤 / 黏膜或易引发敏感反应。" }
};

window.RISK_TAG_MAP = {
  /* 食品 - 非法添加物 */
  "sudan-red": ["illegal", "carcinogen"],
  "melamine": ["illegal"],
  "formalin": ["illegal", "carcinogen"],
  "boroax": ["illegal"],
  "bleaching-powder": ["illegal", "carcinogen"],
  "industrial-h2o2": ["illegal"],
  "industrial-gelatin": ["illegal", "heavyMetal"],
  "plasticizer": ["illegal", "hormone"],
  "clenbuterol": ["illegal"],
  "malachite-green": ["illegal", "carcinogen"],
  "potassium-bromate": ["illegal", "carcinogen"],
  "lindane": ["illegal", "carcinogen"],
  "des": ["illegal", "hormone"],
  "industrial-sulfur": ["illegal"],
  "gutter-oil": ["illegal", "carcinogen"],
  /* 食品 - 限用/中风险 */
  "nitrite": ["metabolic"],
  "dehydroacetate": ["preservative"],
  "aspartame": ["sweetener", "carcinogen"],
  "trans-fat": ["metabolic"],
  "tartrazine": ["colorant"],
  "sunset-yellow": ["colorant"],
  "carmine": ["colorant"],
  "amaranth": ["colorant"],
  "allura-red": ["colorant"],
  "brilliant-blue": ["colorant"],
  "saccharin": ["sweetener"],
  "cyclamate": ["sweetener"],
  "acesulfame": ["sweetener"],
  "sucralose": ["sweetener"],
  "benzoic": ["preservative"],
  "acrylamide": ["carcinogen"],
  "caramel-color": ["colorant"],
  "sulfite": ["preservative"],
  "hfcs": ["metabolic"],
  "bpa": ["hormone"],
  "pfas": ["hormone"],
  /* 食品 - 低风险 */
  "sorbic": ["preservative"],
  "propionate": ["preservative"],
  "msg": ["irritant"],
  /* 护肤/化妆品 - 禁用 */
  "glucocorticoid": ["illegal", "hormone"],
  "hydroquinone": ["illegal"],
  "mercury": ["illegal", "heavyMetal"],
  "lead-arsenic": ["illegal", "heavyMetal"],
  "methanol-cos": ["illegal"],
  "diethylene-glycol": ["illegal"],
  "fluorescent": ["illegal"],
  /* 护肤/化妆品 - 限用/争议 */
  "formaldehyde-releaser": ["preservative", "carcinogen"],
  "oxybenzone": ["hormone"],
  "salicylic-acid": ["irritant"],
  "retinol": ["hormone"],
  "phthalate-cos": ["hormone"],
  "triclosan": ["hormone"],
  "mit": ["preservative", "irritant"],
  "sls": ["irritant"],
  "talc-asbestos": ["carcinogen"],
  "mineral-oil": ["irritant"],
  "fragrance": ["irritant"],
  "phenoxyethanol": ["preservative"],
  "alcohol": ["irritant"],
  "parabens": ["hormone"]
};
