/* 配料表风险扫描 — 成分百科（健康成分说明）
   与 RISK_DB 互补：RISK_DB 记录风险成分，本文件记录常见"中性/有益"成分的简介。
   命中后会在分析结果中展示用途、功效、来源（不与风险卡片混在一起）。
   数据来源：GB 2760-2024、国家卫健委、卫健委食品司相关公告、《益生菌保健食品法规与科学共识》、香港食物安全中心、新华网/央视新闻科普。
   注意：内容仅作科普，不构成医疗建议。*/

(function (root) {
  'use strict';
  var HEALTH_DB = [
    /* ===== 奶类 ===== */
    {
      id: 'raw_milk',
      aliases: ['生牛乳', '生鲜牛乳', '鲜牛奶', '原料乳'],
      name: '生牛乳',
      type: '食品',
      category: '奶制品',
      desc: '未加工的新鲜牛奶。优质蛋白质、钙、维生素 B12 等营养素的主要来源；含天然乳糖。',
      benefits: ['优质蛋白来源（酪蛋白、乳清蛋白）', '钙吸收率高', '含 B 族维生素与维生素 D'],
      cautions: '乳糖不耐受者饮用后易腹胀/腹泻；婴幼儿、孕产妇选巴氏杀菌产品。',
      source: '国家奶业科技创新联盟、《中国食物成分表》。'
    },

    /* ===== 糖醇（功能性甜味剂） ===== */
    {
      id: 'xylitol',
      aliases: ['木糖醇', '木糖', '戊五醇'],
      name: '木糖醇',
      type: '食品',
      category: '糖醇 / 甜味剂',
      desc: '从白桦树、玉米芯等提取的天然五碳糖醇。甜度近似蔗糖但热量低约 40%，不被口腔致龋菌利用，常用于无糖口香糖与糖尿病食品。',
      benefits: ['低热量（2.4 kcal/g）', '不致龋齿', '升糖指数低（GI 7-13）'],
      cautions: '过量（成人 >30g/天）可能引起腹胀/腹泻；宠物（尤其狗）误食可能致命。',
      source: 'GB 2760-2024 食品添加剂使用标准；香港食物安全中心科普。'
    },
    {
      id: 'maltitol',
      aliases: ['麦芽糖醇', '麦芽糖醇糖浆', '氢化麦芽糖'],
      name: '麦芽糖醇',
      type: '食品',
      category: '糖醇 / 甜味剂',
      desc: '由麦芽糖氢化制得的二糖醇，甜度约为蔗糖 75-90%，常用于无糖巧克力、低糖糕点。',
      benefits: ['不致龋齿', '不引起血糖快速升高', '热量约 2.1 kcal/g（蔗糖的 50%）'],
      cautions: '一次大量食用可能引起腹泻（成人建议 <40g/天）。',
      source: 'GB 2760-2024；欧盟 EFSA 评估报告。'
    },
    {
      id: 'erythritol',
      aliases: ['赤藓糖醇', '赤藓醇'],
      name: '赤藓糖醇',
      type: '食品',
      category: '糖醇 / 甜味剂',
      desc: '天然存在于水果、发酵食品中的四碳糖醇。甜度为蔗糖 60-70%，热量仅 0.2 kcal/g，几乎不参与代谢，近年在"零糖"饮料中广泛使用。',
      benefits: ['几乎零热量', '不升血糖', '不致龋齿', '耐受性优于其他糖醇'],
      cautions: '2023 年有研究关注其与心血管事件相关性，但因果关系未确立；常规食用量通常安全。',
      source: 'GB 2760-2024；EFSA 2015 评估。'
    },
    {
      id: 'sorbitol',
      aliases: ['山梨糖醇', '山梨醇', 'D-山梨醇'],
      name: '山梨糖醇',
      type: '食品',
      category: '糖醇 / 保湿剂',
      desc: '常见于水果（梨、苹果）中的六碳糖醇。甜度约为蔗糖 50%，有保湿作用，常用于无糖糖果、烘焙。',
      benefits: ['不致龋齿', '升糖指数低', '保湿与润肠通便'],
      cautions: '过量（>20g/天）可能腹泻；肾功能不全者慎用。',
      source: 'GB 2760-2024。'
    },

    /* ===== 膳食纤维 / 益生元 ===== */
    {
      id: 'polydextrose',
      aliases: ['聚葡萄糖', '葡聚糖'],
      name: '聚葡萄糖',
      type: '食品',
      category: '水溶性膳食纤维',
      desc: '由葡萄糖与少量山梨醇随机聚合而成的水溶性膳食纤维，热量约 1 kcal/g。常用于乳制品、饮料补充纤维。',
      benefits: ['增加饱腹感', '促进肠道蠕动', '有助于血糖平稳', '低热量'],
      cautions: '起始食用建议少量（避免腹胀）；急性肠炎期慎用。',
      source: 'GB 25547-2010 食品安全国家标准 食品添加剂 聚葡萄糖。'
    },
    {
      id: 'fructo_oligosaccharide',
      aliases: ['低聚果糖', '果寡糖', 'FOS'],
      name: '低聚果糖',
      type: '食品',
      category: '益生元',
      desc: '由蔗糖经果糖基转移酶作用得到的果糖低聚物，是双歧杆菌等益生菌的"食物"。',
      benefits: ['调节肠道菌群', '促进钙吸收', '低热量甜味剂'],
      cautions: '过量（>30g/天）可能腹胀、排气增多。',
      source: 'GB/T 23528-2009；中国食品科学技术学会益生菌分会共识。'
    },
    {
      id: 'inulin',
      aliases: ['菊粉', '菊糖', '菊苣根纤维'],
      name: '菊粉',
      type: '食品',
      category: '益生元 / 膳食纤维',
      desc: '来源于菊苣、菊芋等植物的果聚糖型膳食纤维，是优质益生元。',
      benefits: ['促进双歧杆菌增殖', '改善肠道健康', '有助于脂质代谢'],
      cautions: 'FTIRDS 患者（一种食物不耐受）禁用；起始食用需少量。',
      source: 'GB 规格标准；中国营养学会膳食纤维专家共识。'
    },

    /* ===== 益生菌（截图里 8+ 种） ===== */
    {
      id: 'lactococcus_lactis',
      aliases: ['乳酸乳球菌', '乳酸球菌', 'lactococcus lactis'],
      name: '乳酸乳球菌',
      type: '食品',
      category: '益生菌',
      desc: '乳球菌属常见菌种，传统乳制品（奶酪、发酵乳）发酵剂。',
      benefits: ['产乳酸、抑制有害菌', '产生细菌素等天然抑菌物质', '赋予发酵风味'],
      cautions: '免疫严重低下者使用益生菌应遵医嘱。',
      source: '《益生菌保健食品法规与科学共识（2020）》。'
    },
    {
      id: 'lactococcus_lactis_subsp_lactis',
      aliases: ['乳酸乳球菌乳酸亚种', '乳酸乳球菌乳酸亚种(双乙酰型)'],
      name: '乳酸乳球菌乳酸亚种',
      type: '食品',
      category: '益生菌',
      desc: '乳酸乳球菌的亚种，常用于奶酪与发酵乳的成熟发酵，能产双乙酰（黄油风味化合物）。',
      benefits: ['赋予"黄油/坚果"风味', '抑制杂菌生长', '产乳酸'],
      cautions: '一般认为安全（GRAS）；双乙酰型工作场所吸入高浓度可能引发细支气管炎（与食品添加无关）。',
      source: '《食品安全国家标准 食品加工用菌种》相关目录；《益生菌科学共识》。'
    },
    {
      id: 'leuconostoc_mesenteroides',
      aliases: ['肠膜明串珠菌', '肠膜明串珠菌肠膜亚种', '明串珠菌'],
      name: '肠膜明串珠菌肠膜亚种',
      type: '食品',
      category: '益生菌',
      desc: '植物源发酵菌，传统用于泡菜、酸面包的天然发酵；产果聚糖 EPS。',
      benefits: ['产细菌素，天然防腐', '产胞外多糖，改善口感', '帮助消化植物原料'],
      cautions: '对蔗糖敏感者需注意 EPS 含量。',
      source: '《益生菌科学共识》；中国传统发酵食品研究。'
    },
    {
      id: 'lactobacillus_delbrueckii_bulgaricus',
      aliases: ['德氏乳杆菌保加利亚亚种', '保加利亚乳杆菌', 'lactobacillus bulgaricus'],
      name: '德氏乳杆菌保加利亚亚种',
      type: '食品',
      category: '益生菌',
      desc: '经典酸奶发酵菌种之一，与嗜热链球菌共生。',
      benefits: ['分解乳糖，缓解乳糖不耐', '产乳酸与抑菌物质', '赋予酸奶特有风味'],
      cautions: '对乳制品严重过敏者禁用。',
      source: '《益生菌保健食品法规与科学共识（2020）》。'
    },
    {
      id: 'streptococcus_thermophilus',
      aliases: ['唾液链球菌嗜热亚种', '嗜热链球菌', 'streptococcus thermophilus'],
      name: '唾液链球菌嗜热亚种',
      type: '食品',
      category: '益生菌',
      desc: '经典酸奶菌种之一，与保加利亚乳杆菌协同发酵。',
      benefits: ['分解乳糖', '产叶酸', '产细菌素抑制有害菌'],
      cautions: '一般安全。',
      source: '《益生菌保健食品法规与科学共识（2020）》。'
    },
    {
      id: 'lactobacillus_acidophilus',
      aliases: ['嗜酸乳杆菌', 'lactobacillus acidophilus', '嗜酸杆菌'],
      name: '嗜酸乳杆菌',
      type: '食品',
      category: '益生菌',
      desc: '可在 pH 较低环境下存活，定植于小肠。常见于酸奶、益生菌补充剂。',
      benefits: ['耐胃酸、胆汁', '调节肠道菌群', '辅助消化乳糖'],
      cautions: '免疫严重低下者、危重病人慎用。',
      source: '《益生菌科学共识》；国家卫健委《可用于食品的菌种名单》。'
    },
    {
      id: 'lactobacillus_paracasei',
      aliases: ['副干酪乳杆菌', 'lactobacillus paracasei'],
      name: '副干酪乳杆菌',
      type: '食品',
      category: '益生菌',
      desc: '广泛存在于人体肠道与发酵食品。常用于益生菌制剂，研究覆盖过敏、口腔健康等。',
      benefits: ['耐胃酸、胆汁', '调节免疫', '辅助改善季节性过敏'],
      cautions: '严重免疫缺陷者慎用。',
      source: '《益生菌科学共识》；卫健委《可用于食品的菌种名单》。'
    },
    {
      id: 'bifidobacterium_animalis',
      aliases: ['动物双歧杆菌', '动物双歧杆菌乳亚种', 'bifidobacterium animalis', 'BB-12'],
      name: '动物双歧杆菌乳亚种',
      type: '食品',
      category: '益生菌',
      desc: '常见于发酵乳的双歧杆菌之一（如 BB-12 株），研究与应用历史长。',
      benefits: ['调节肠道菌群', '改善便秘与腹泻', '辅助免疫调节'],
      cautions: '严重免疫缺陷者遵医嘱。',
      source: '《益生菌科学共识》；国家卫健委公告。'
    },
    {
      id: 'lactobacillus_rhamnosus',
      aliases: ['鼠李糖乳杆菌', 'LGG', 'lactobacillus rhamnosus GG'],
      name: '鼠李糖乳杆菌',
      type: '食品',
      category: '益生菌',
      desc: '研究最深入的益生菌之一（LGG 株），广泛用于发酵乳、益生菌补充剂。',
      benefits: ['耐胃酸胆汁', '调节肠道菌群', '辅助缓解抗生素相关腹泻', '研究覆盖婴幼儿湿疹辅助预防'],
      cautions: '免疫严重低下者遵医嘱；罕见情况下对极重症患者有菌血症风险。',
      source: '《益生菌科学共识》；国家卫健委《可用于食品的菌种名单》。'
    },
    {
      id: 'lactic_acid',
      aliases: ['乳酸'],
      name: '乳酸',
      type: '食品',
      category: '有机酸 / 酸度调节剂',
      desc: '乳酸菌发酵产生的有机酸，也是人体代谢中间产物。常用作酸度调节剂。',
      benefits: ['提供发酵风味', '抑制杂菌', '有助于钙吸收'],
      cautions: '胃酸过多者大量摄入可能不适。',
      source: 'GB 2760-2024；GB 1886.173-2016 食品安全国家标准 食品添加剂 乳酸。'
    },

    /* ===== 风味/代谢物 ===== */
    {
      id: 'diacetyl',
      aliases: ['双乙酰', '丁二酮', '双乙酰型'],
      name: '双乙酰（丁二酮）',
      type: '食品',
      category: '风味化合物',
      desc: '某些乳酸菌（如乳酸乳球菌双乙酰型亚种）发酵产生的天然黄油/坚果风味化合物，常见于发酵乳、奶酪、啤酒。',
      benefits: ['赋予天然奶油香气', '存在于天然发酵食品'],
      cautions: '**食品中含量极低，正常食用安全。** 高浓度工业吸入（如人造黄油厂）与"爆米花肺"相关，与日常食用无关。',
      source: '《食品风味化学》；FDA GRAS 列表。'
    },

    /* ===== 常见甜味剂 / 防腐（中性） ===== */
    {
      id: 'sucralose',
      aliases: ['三氯蔗糖'],
      name: '三氯蔗糖',
      type: '食品',
      category: '高倍甜味剂',
      desc: '以蔗糖为原料经氯化制得的高倍甜味剂，甜度为蔗糖 600 倍。',
      benefits: ['几乎零热量', '不升血糖', '不致龋齿'],
      cautions: '现有证据支持 ADI 范围内（15 mg/kg·d）安全；苯丙酮尿症者因生产工艺可能含微量苯丙氨酸（产品标签通常会注明）。',
      source: 'GB 2760-2024；JECFA 评估；香港食物安全中心专题。'
    }
  ];

  /* 同 db.js：node + browser 双兼容 */
  root.HEALTH_DB = HEALTH_DB;

  /* 暴露简单的最长别名匹配（同 db.js） */
  function bestAliasLenForTokenHealth(entry, token) {
    var tn = String(token || '').toLowerCase().replace(/\s+/g, '');
    if (!tn) return 0;
    var best = 0;
    entry.aliases.forEach(function (a) {
      var an = String(a || '').toLowerCase().replace(/\s+/g, '');
      if (!an) return;
      // 子串/包含 都算
      if (tn.indexOf(an) !== -1 || an.indexOf(tn) !== -1) {
        if (an.length > best) best = an.length;
      }
    });
    return best;
  }
  root.bestAliasLenForTokenHealth = bestAliasLenForTokenHealth;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HEALTH_DB: HEALTH_DB, bestAliasLenForTokenHealth: bestAliasLenForTokenHealth };
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
