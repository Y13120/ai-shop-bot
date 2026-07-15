const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, REST, Routes, SlashCommandBuilder, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ═══════════════ DATA ═══════════════
const DATA = path.join(__dirname, 'data');
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });

function load(f, d) { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { return d; } }
function save(f, d) { fs.writeFileSync(path.join(DATA, f), JSON.stringify(d, null, 2), 'utf8'); }

const CFG = load('config.json', {});
if (process.env.BOT_TOKEN) CFG.token = process.env.BOT_TOKEN;
if (process.env.CLIENT_ID) CFG.clientId = process.env.CLIENT_ID;
if (process.env.GUILD_ID) CFG.guildId = process.env.GUILD_ID;

function getServices() { return load('services.json', []); }
function getOrders() { return load('orders.json', []); }
function getReviews() { return load('reviews.json', []); }

function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toLocaleString();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════ CLIENT ═══════════════
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// ═══════════════ SLASH COMMANDS ═══════════════
const cmds = [
  new SlashCommandBuilder().setName('setup').setDescription('إعداد السيرفر بالكامل').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder().setName('services').setDescription('عرض كل الخدمات المتاحة'),

  new SlashCommandBuilder().setName('order').setDescription('طلب خدمة')
    .addStringOption(o => o.setName('service').setDescription('رقم الخدمة').setRequired(true)),

  new SlashCommandBuilder().setName('credits').setDescription('عرض أو إرسال كريديت (عبر ProBot)')
    .addUserOption(o => o.setName('user').setDescription('المستخدم (اختياري)'))
    .addNumberOption(o => o.setName('amount').setDescription('المبلغ (اختياري)')),

  new SlashCommandBuilder().setName('add-service').setDescription('إضافة خدمة جديدة').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('name').setDescription('اسم الخدمة').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('الوصف').setRequired(true))
    .addNumberOption(o => o.setName('price').setDescription('السعر بالكريديت').setRequired(true))
    .addStringOption(o => o.setName('category').setDescription('التصنيف').setRequired(true)
      .addChoices({ name: 'ChatGPT', value: 'chatgpt' }, { name: 'Image', value: 'image' }, { name: 'Voice', value: 'voice' }, { name: 'Code', value: 'code' }, { name: 'Writing', value: 'writing' }, { name: 'Data', value: 'data' }, { name: 'Other', value: 'other' }))
    .addStringOption(o => o.setName('emoji').setDescription('إيموجي')),

  new SlashCommandBuilder().setName('remove-service').setDescription('حذف خدمة').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('id').setDescription('رقم الخدمة').setRequired(true)),

  new SlashCommandBuilder().setName('review').setDescription('تقييم خدمة')
    .addStringOption(o => o.setName('service').setDescription('رقم الخدمة').setRequired(true))
    .addNumberOption(o => o.setName('rating').setDescription('التقييم 1-5').setRequired(true))
    .addStringOption(o => o.setName('comment').setDescription('تعليق')),

  new SlashCommandBuilder().setName('leaderboard').setDescription('ترتيب أعلى المستخدمين بالكريديت'),

  new SlashCommandBuilder().setName('help').setDescription('عرض كل الأوامر'),
];

// ═══════════════ COMMANDS ═══════════════

async function handleSetup(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const g = interaction.guild;
  const log = [];

  let chs = await g.channels.fetch();
  for (const [, ch] of chs) { try { await ch.delete(); } catch(e) { log.push(`❌ ${ch.name}`); } await sleep(800); }

  let rls = await g.roles.fetch();
  for (const [, r] of rls) {
    if (r.name === '@everyone' || r.managed) continue;
    try { await r.delete(); } catch(e) { log.push(`❌ رول ${r.name}`); } await sleep(600);
  }
  await sleep(1500);

  const roles = {};
  for (const rd of [
    { k: 'admin', n: '⚡⚡⚡ ┃ Admin', c: '#E74C3C', p: [PermissionFlagsBits.Administrator] },
    { k: 'staff', n: '⭐⭐⭐ ┃ Staff', c: '#F1C40F', p: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.SendMessages] },
    { k: 'customer', n: '🛒 ┃ Customer', c: '#1ABC9C', p: [] },
    { k: 'vip', n: '💎 ┃ VIP', c: '#9B59B6', p: [] },
  ]) {
    try { roles[rd.k] = await g.roles.create({ name: rd.n, color: rd.c, permissions: rd.p }); log.push(`✅ ${rd.n}`); } catch(e) { log.push(`❌ ${rd.n}`); }
    await sleep(600);
  }

  const noSend = [{ id: g.id, deny: [PermissionFlagsBits.SendMessages] }];
  const full = [{ id: g.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }];

  const structure = [
    { n: '╔════════ 🏪 المتجر ════════', chs: [
      { n: '🛒・الخدمات', p: full }, { n: '📝・كيف-تطلب', p: noSend },
      { n: '⭐・التقييمات', p: [{ id: g.id, deny: [PermissionFlagsBits.SendMessages] }, { id: roles.customer?.id, allow: [PermissionFlagsBits.SendMessages] }] },
    ]},
    { n: '╔════════ 🎫 التذاكر ════════', chs: [] },
    { n: '╔════════ 📢 الإعلانات ════════', chs: [
      { n: '📣・الإعلانات', p: noSend }, { n: '📋・القواعد', p: noSend },
    ]},
    { n: '╔════════ 💬 الدردشة ════════', chs: [
      { n: '💬・العامة', p: full }, { n: '🤖・اوامر-البوت', p: full },
    ]},
    { n: '╔════════ 📌 معلومات ════════', chs: [
      { n: '📊・حالة-السيرفر', p: noSend },
    ]},
  ];

  for (const cat of structure) {
    try {
      const c = await g.channels.create({ name: cat.n, type: ChannelType.GuildCategory });
      log.push(`✅ ${cat.n}`);
      for (const ch of cat.chs) {
        try {
          await g.channels.create({ name: ch.n, type: ChannelType.GuildText, parent: c.id, permissionOverwrites: ch.p });
          log.push(`✅ ${ch.n}`);
        } catch(e) { log.push(`❌ ${ch.n}`); }
        await sleep(600);
      }
    } catch(e) { log.push(`❌ كاتيقوري`); }
    await sleep(600);
  }

  await g.channels.fetch();
  const tc = g.channels.cache.find(c => c.name.includes('التذاكر') && c.type === ChannelType.GuildCategory);
  if (tc) { CFG.ticketCategory = tc.id; save('config.json', CFG); }

  await sleep(1500);
  await g.channels.fetch();

  const svcCh = g.channels.cache.find(c => c.name.includes('الخدمات') && c.isTextBased());
  if (svcCh) {
    const e = new EmbedBuilder()
      .setTitle('🤖 مرحباً بك في متجر الذكاء الاصطناعي')
      .setDescription('━━━━━━━━━━━━━━━━━━━━━\n\n**مرحباً بك في أفضل متجر لخدمات الذكاء الاصطناعي!** 🚀\n\n━━━━━━━━━━━━━━━━━━━━━\n\n**الخدمات المتاحة:**\n\n🤖 **ChatGPT Plus** — محادثات ذكية\n🎨 **توليد الصور** — Midjourney, DALL-E 3\n💻 **برمجة** — مساعدة في أي لغة\n📝 **كتابة** — مقالات ونصوص\n📊 **تحليل بيانات** — تقارير\n🔊 **صوت** — تحويل وتعديل\n\n━━━━━━━━━━━━━━━━━━━━━\n\n**💡 كيف تبدأ؟**\n\n> `1️⃣` اكتب `/services` لعرض الخدمات\n> `2️⃣` اكتب `/order [رقم]` لفتح تذكرة\n> `3️⃣` ادفع واستنّى الستاف\n> `4️⃣` بعد التسليم، قيّم بـ `/review`\n\n━━━━━━━━━━━━━━━━━━━━━')
      .setColor('#FF0000').setTimestamp().setFooter({ text: '🛍️ AI Shop Bot' });
    await svcCh.send({ embeds: [e] });
  }

  const rulesCh = g.channels.cache.find(c => c.name.includes('القواعد') && c.isTextBased());
  if (rulesCh) {
    const e = new EmbedBuilder()
      .setTitle('📋 قواعد السيرفر')
      .setDescription('━━━━━━━━━━━━━━━━━━━━━\n\n**1.** 🤝 احترام الجميع\n**2.** 🚫 لا محتوى مخالف\n**3.** 🎫 تذكرة لكل طلب\n**4.** 💰 الدفع مقدماً\n**5.** 🔒 لا تشارك حساباتك\n**6.** 👑 اتبع الادمن\n\n━━━━━━━━━━━━━━━━━━━━━')
      .setColor('#FFB900').setTimestamp();
    await rulesCh.send({ embeds: [e] });
  }

  const howCh = g.channels.cache.find(c => c.name.includes('كيف-تطلب') && c.isTextBased());
  if (howCh) {
    const e = new EmbedBuilder()
      .setTitle('📝 دليل طلب الخدمة')
      .setDescription('**Step 1** 🛒 اكتب `/services` لعرض الخدمات\n**Step 2** 🎯 اختار الخدمة\n**Step 3** 🎫 اكتب `/order [رقم]` لفتح تذكرة\n**Step 4** 💬 تواصل مع الستاف\n**Step 5** 💰 ادفع\n**Step 6** ✅ استلم وقيّم بـ `/review`')
      .setColor('#2ECC71').setTimestamp();
    await howCh.send({ embeds: [e] });
  }

  await interaction.editReply(`✅ تم الإعداد!\n\n${log.join('\n')}`);
}

async function handleServices(interaction) {
  const services = getServices().filter(s => s.active);
  if (!services.length) return interaction.reply({ content: '📭 لا توجد خدمات حالياً', ephemeral: true });

  const cats = {};
  for (const s of services) {
    if (!cats[s.category]) cats[s.category] = [];
    cats[s.category].push(s);
  }

  const catNames = { chatgpt: '🤖 ChatGPT', image: '🎨 صور', voice: '🔊 صوت', code: '💻 برمجة', writing: '📝 كتابة', data: '📊 بيانات', other: '📦 أخرى' };

  const embed = new EmbedBuilder()
    .setTitle('🛒 الخدمات المتاحة')
    .setColor('#FF0000')
    .setTimestamp()
    .setFooter({ text: `📊 ${services.length} خدمة متاحة` });

  for (const [cat, items] of Object.entries(cats)) {
    embed.addFields({
      name: catNames[cat] || cat,
      value: items.map(s => `${s.emoji} **${s.name}** — \`${fmt(s.price)}\` كريديت`).join('\n'),
    });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleOrder(interaction) {
  const id = parseInt(interaction.options.getString('service'));
  const services = getServices();
  const service = services.find(s => s.id === id && s.active);
  if (!service) return interaction.reply({ content: '❌ خدمة غير موجودة. استخدم `/services` لعرض الخدمات', ephemeral: true });

  const g = interaction.guild, user = interaction.user;
  const tc = CFG.ticketCategory ? g.channels.cache.get(CFG.ticketCategory) : null;

  const ch = await g.channels.create({
    name: `ticket-${user.username}-${service.id}`,
    type: ChannelType.GuildText,
    parent: tc?.id || null,
    permissionOverwrites: [
      { id: g.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ],
  });

  const orders = getOrders();
  const oid = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1;
  orders.push({ id: oid, serviceId: service.id, serviceName: service.name, userId: user.id, username: user.username, channelId: ch.id, price: service.price, status: 'pending', createdAt: Date.now() });
  save('orders.json', orders);

  const embed = new EmbedBuilder()
    .setTitle(`🎫 طلب #${oid}`)
    .setDescription(`**الخدمة:** ${service.emoji} ${service.name}\n**العميل:** ${user}\n**السعر:** \`${fmt(service.price)}\` كريديت\n**الحالة:** ⏳ معلق`)
    .setColor('#FFB900').setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`order_accept_${oid}`).setLabel('✅ قبول').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`order_complete_${oid}`).setLabel('🏁 إتمام').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`order_close_${oid}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Secondary),
  );

  await ch.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ تم فتح التذكرة: ${ch}`, ephemeral: true });
}

async function handleAddService(interaction) {
  const name = interaction.options.getString('name');
  const desc = interaction.options.getString('description');
  const price = interaction.options.getNumber('price');
  const category = interaction.options.getString('category');
  const emoji = interaction.options.getString('emoji') || '🤖';

  const services = getServices();
  const id = services.length > 0 ? Math.max(...services.map(s => s.id)) + 1 : 1;
  services.push({ id, name, description: desc, price, category, emoji, active: true, createdAt: Date.now() });
  save('services.json', services);

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${name}`)
    .setDescription(desc)
    .addFields({ name: '💰 السعر', value: `\`${fmt(price)}\` كريديت`, inline: true }, { name: '📂 التصنيف', value: category, inline: true })
    .setColor('#2ECC71').setTimestamp();
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRemoveService(interaction) {
  const id = parseInt(interaction.options.getString('id'));
  let services = getServices();
  const svc = services.find(s => s.id === id);
  if (!svc) return interaction.reply({ content: '❌ خدمة غير موجودة', ephemeral: true });
  services = services.filter(s => s.id !== id);
  save('services.json', services);
  await interaction.reply({ content: `✅ تم حذف: ${svc.emoji} ${svc.name}`, ephemeral: true });
}

async function handleCredits(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  const amount = interaction.options.getNumber('amount');

  if (amount && interaction.user.id === user.id) {
    return interaction.reply({ content: '❌ لا تقدر تبعت كريديت لنفسك', ephemeral: true });
  }

  if (amount) {
    const embed = new EmbedBuilder()
      .setTitle('💰 تحويل كريديت')
      .setDescription(`استخدم أمر ProBot:\n\n\`/credits ${user} ${amount} دفع للخدمة\`\n\nأو اكتب:\n\`/credits ${user} ${amount}\``)
      .setColor('#3498DB').setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else {
    const embed = new EmbedBuilder()
      .setTitle('💰 الكريديت')
      .setDescription(`**${user.username}** — استخدم أمر **ProBot** لعرض رصيدك:\n\n\`/credits\`\n\nأو ل转账:\n\`/credits @المستخدم المبلغ\``)
      .setColor('#2ECC71').setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleReview(interaction) {
  const id = parseInt(interaction.options.getString('service'));
  const rating = interaction.options.getNumber('rating');
  const comment = interaction.options.getString('comment') || '';
  const services = getServices();
  const svc = services.find(s => s.id === id);
  if (!svc) return interaction.reply({ content: '❌ خدمة غير موجودة', ephemeral: true });
  if (rating < 1 || rating > 5) return interaction.reply({ content: '❌ التقييم من 1 لـ 5', ephemeral: true });

  const reviews = getReviews();
  reviews.push({ id: reviews.length > 0 ? Math.max(...reviews.map(r => r.id)) + 1 : 1, serviceId: id, serviceName: svc.name, userId: interaction.user.id, username: interaction.user.username, rating, comment, createdAt: Date.now() });
  save('reviews.json', reviews);

  const embed = new EmbedBuilder()
    .setTitle('⭐ تم التقييم')
    .setDescription(`**الخدمة:** ${svc.emoji} ${svc.name}\n**التقييم:** ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}\n**التعليق:** ${comment || 'بدون'}`)
    .setColor('#F1C40F').setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function handleLeaderboard(interaction) {
  const orders = getOrders();
  const userOrders = {};
  for (const o of orders) {
    if (o.status === 'completed') {
      userOrders[o.username] = (userOrders[o.username] || 0) + 1;
    }
  }
  const entries = Object.entries(userOrders).sort(([,a], [,b]) => b - a).slice(0, 10);
  if (!entries.length) return interaction.reply({ content: '📭 لا توجد طلبات مكتملة بعد', ephemeral: true });

  const medals = ['🥇', '🥈', '🥉'];
  const desc = entries.map(([name, count], i) => `${medals[i] || `**${i+1}.**`} ${name} — **${count}** طلب مكتمل`).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🏆 أكثر المستخدمين طلباتاً')
    .setDescription(desc)
    .setColor('#FFD700').setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function handleHelp(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🤖 أوامر البوت')
    .addFields(
      { name: '📦 عامة', value: '`/services` عرض الخدمات\n`/order` طلب خدمة\n`/credits` الكريديت (ProBot)\n`/review` تقييم\n`/leaderboard` الترتيب\n`/help` المساعدة' },
      { name: '👑 إدارية', value: '`/setup` إعداد السيرفر\n`/add-service` إضافة خدمة\n`/remove-service` حذف خدمة' },
      { name: '💰 الدفع', value: 'الدفع يتم عبر **ProBot**:\n`/credits` لعرض الرصيد\n`/credits @user amount` للتحويل' },
    )
    .setColor('#FF0000').setTimestamp();
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ═══════════════ HANDLER ═══════════════
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const map = {
        setup: handleSetup, services: handleServices, order: handleOrder,
        'add-service': handleAddService, 'remove-service': handleRemoveService,
        credits: handleCredits,
        review: handleReview, leaderboard: handleLeaderboard, help: handleHelp,
      };
      if (map[interaction.commandName]) await map[interaction.commandName](interaction);
    } else if (interaction.isButton() && interaction.customId.startsWith('order_')) {
      const [, type, idStr] = interaction.customId.split('_');
      const oid = parseInt(idStr);
      const orders = getOrders();
      const order = orders.find(o => o.id === oid);
      if (!order) return interaction.reply({ content: '❌', ephemeral: true });

      if (type === 'accept') {
        order.status = 'progress'; save('orders.json', orders);
        await interaction.reply({ content: `✅ قبل الطلب ${interaction.user}` });
      } else if (type === 'complete') {
        order.status = 'completed'; save('orders.json', orders);
        await interaction.reply({ content: '🏁 تم إتمام الطلب! استخدم `/credits` لتحويل الكريديت عبر ProBot' });
      } else if (type === 'close') {
        order.status = 'closed'; save('orders.json', orders);
        await interaction.reply({ content: '🗑️ إغلاق التذكرة...' });
        setTimeout(() => { const c = interaction.guild.channels.cache.get(order.channelId); if (c) c.delete().catch(() => {}); }, 2000);
      }
    }
  } catch (err) {
    console.error('Error:', err);
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ حصل خطأ', ephemeral: true }).catch(() => {});
  }
});

client.on('ready', () => {
  console.log(`✅ Bot: ${client.user.tag} | ${client.guilds.cache.size} servers`);
  client.user.setActivity('AI Services Shop', { type: 3 });
});

client.on('guildMemberAdd', async (member) => {
  try {
    const role = member.guild.roles.cache.find(r => r.name.includes('Customer'));
    if (role) await member.roles.add(role);
  } catch {}
});

// ═══════════════ HTTP API (Panel) ═══════════════
const API_PORT = process.env.BOT_API_PORT || 3001;

function parseBody(req) { return new Promise((ok, no) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { ok({}); } }); req.on('error', no); }); }
function jsonRes(res, code, data) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); }

const apiServer = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const guild = client.guilds.cache.first();
  if (!guild && !p.startsWith('/api/bot')) return jsonRes(res, 500, { error: 'Bot not in guild' });

  try {
    // GUILD
    if (req.method === 'GET' && p === '/api/guild') {
      return jsonRes(res, 200, { id: guild.id, name: guild.name, icon: guild.iconURL({ dynamic: true, size: 256 }), memberCount: guild.memberCount, ownerId: guild.ownerId, createdAt: guild.createdAt.toISOString(), boostCount: guild.premiumSubscriptionCount || 0 });
    }
    if (req.method === 'PATCH' && p === '/api/guild') {
      const data = await parseBody(req);
      if (data.name) await guild.setName(data.name);
      if (data.icon) { const b64 = data.icon.replace(/^data:image\/\w+;base64,/, ''); await guild.setIcon(Buffer.from(b64, 'base64')); }
      return jsonRes(res, 200, { ok: true });
    }

    // BOT
    if (req.method === 'GET' && p === '/api/bot') {
      return jsonRes(res, 200, { id: client.user.id, username: client.user.username, avatar: client.user.displayAvatarURL({ dynamic: true, size: 256 }) });
    }
    if (req.method === 'PATCH' && p === '/api/bot') {
      const data = await parseBody(req);
      if (data.username) await client.user.setUsername(data.username);
      if (data.avatar) { const b64 = data.avatar.replace(/^data:image\/\w+;base64,/, ''); await client.user.setAvatar(Buffer.from(b64, 'base64')); }
      return jsonRes(res, 200, { ok: true });
    }

    // CHANNELS
    if (req.method === 'GET' && p === '/api/channels') {
      return jsonRes(res, 200, guild.channels.cache.sort((a, b) => a.position - b.position).map(c => ({ id: c.id, name: c.name, type: c.type, parent: c.parentId, position: c.position, topic: c.topic || '' })));
    }
    if (req.method === 'POST' && p === '/api/channels') {
      const d = await parseBody(req);
      const ch = await guild.channels.create({ name: d.name, type: d.type || 0, parent: d.parent || null, topic: d.topic || '' });
      return jsonRes(res, 200, { ok: true, id: ch.id });
    }
    if (req.method === 'DELETE' && p.startsWith('/api/channels/')) {
      const ch = guild.channels.cache.get(p.split('/')[3]);
      if (!ch) return jsonRes(res, 404, { error: 'Not found' });
      await ch.delete(); return jsonRes(res, 200, { ok: true });
    }

    // CATEGORIES
    if (req.method === 'GET' && p === '/api/categories') {
      return jsonRes(res, 200, guild.channels.cache.filter(c => c.type === 4).sort((a, b) => a.position - b.position).map(c => ({ id: c.id, name: c.name, position: c.position })));
    }

    // ROLES
    if (req.method === 'GET' && p === '/api/roles') {
      return jsonRes(res, 200, guild.roles.cache.sort((a, b) => b.position - a.position).map(r => ({ id: r.id, name: r.name, color: r.hexColor, mentionable: r.mentionable, hoist: r.hoist, members: r.members.size, managed: r.managed })));
    }
    if (req.method === 'POST' && p === '/api/roles') {
      const d = await parseBody(req);
      const r = await guild.roles.create({ name: d.name, color: d.color || '#000000', mentionable: d.mentionable || false, hoist: d.hoist || false });
      return jsonRes(res, 200, { ok: true, id: r.id });
    }
    if (req.method === 'DELETE' && p.startsWith('/api/roles/')) {
      const r = guild.roles.cache.get(p.split('/')[3]);
      if (!r || r.name === '@everyone' || r.managed) return jsonRes(res, 400, { error: 'Cannot delete' });
      await r.delete(); return jsonRes(res, 200, { ok: true });
    }

    // MEMBERS
    if (req.method === 'GET' && p === '/api/members') {
      await guild.members.fetch();
      return jsonRes(res, 200, guild.members.cache.sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0)).map(m => ({
        id: m.id, username: m.user.username, displayName: m.displayName,
        avatar: m.user.displayAvatarURL({ dynamic: true, size: 64 }),
        roles: m.roles.cache.filter(r => r.id !== guild.id).map(r => r.id),
        joinedAt: m.joinedAt?.toISOString(),
      })));
    }
    if (req.method === 'PATCH' && p.startsWith('/api/members/')) {
      const m = guild.members.cache.get(p.split('/')[3]);
      if (!m) return jsonRes(res, 404, { error: 'Not found' });
      const d = await parseBody(req);
      if (d.roles) await m.roles.set(d.roles);
      if (d.nickname) await m.setNickname(d.nickname);
      return jsonRes(res, 200, { ok: true });
    }
    if (req.method === 'DELETE' && p.startsWith('/api/members/')) {
      const m = guild.members.cache.get(p.split('/')[3]);
      if (!m) return jsonRes(res, 404, { error: 'Not found' });
      const d = await parseBody(req);
      d.ban ? await m.ban({ reason: d.reason }) : await m.kick(d.reason);
      return jsonRes(res, 200, { ok: true });
    }

    // ANNOUNCE
    if (req.method === 'POST' && p === '/api/announce') {
      const d = await parseBody(req);
      const ch = guild.channels.cache.find(c => c.name.includes('الإعلانات') && c.isTextBased() && !c.isThread());
      if (!ch) return jsonRes(res, 404, { error: 'قناة الإعلانات غير موجودة' });
      await ch.send({ embeds: [new EmbedBuilder().setTitle(`${d.emoji || '📣'} ${d.title}`).setDescription(d.content).setColor(d.color || '#FF0000').setTimestamp().setFooter({ text: '📢 إعلان من لوحة التحكم' })] });
      return jsonRes(res, 200, { ok: true });
    }

    // SEND MESSAGE
    if (req.method === 'POST' && p === '/api/send') {
      const d = await parseBody(req);
      const ch = guild.channels.cache.get(d.channelId);
      if (!ch || !ch.isTextBased()) return jsonRes(res, 404, { error: 'Channel not found' });
      await ch.send({ content: d.content || '' });
      return jsonRes(res, 200, { ok: true });
    }

    // ═══════════════ TICKETS ═══════════════

    // List all ticket channels (order channels)
    if (req.method === 'GET' && p === '/api/tickets') {
      const orders = getOrders();
      const tickets = [];
      for (const order of orders) {
        const ch = guild.channels.cache.get(order.channelId);
        if (!ch) continue;
        let messages = [];
        try {
          const fetched = await ch.messages.fetch({ limit: 20 });
          messages = fetched.reverse().map(m => ({
            id: m.id, author: m.author.username, authorId: m.author.id,
            avatar: m.author.displayAvatarURL({ dynamic: true, size: 64 }),
            content: m.content, timestamp: m.createdAt.toISOString(),
            isBot: m.author.bot,
          }));
        } catch {}
        tickets.push({
          orderId: order.id, serviceId: order.serviceId, serviceName: order.serviceName,
          userId: order.userId, username: order.username, channelId: order.channelId,
          price: order.price, status: order.status, createdAt: order.createdAt,
          channelName: ch.name, messages,
        });
      }
      return jsonRes(res, 200, tickets);
    }

    // Get single ticket with messages
    if (req.method === 'GET' && p.startsWith('/api/tickets/')) {
      const oid = parseInt(p.split('/')[3]);
      const orders = getOrders();
      const order = orders.find(o => o.id === oid);
      if (!order) return jsonRes(res, 404, { error: 'Order not found' });
      const ch = guild.channels.cache.get(order.channelId);
      if (!ch) return jsonRes(res, 404, { error: 'Channel not found' });
      let messages = [];
      try {
        const fetched = await ch.messages.fetch({ limit: 50 });
        messages = fetched.reverse().map(m => ({
          id: m.id, author: m.author.username, authorId: m.author.id,
          avatar: m.author.displayAvatarURL({ dynamic: true, size: 64 }),
          content: m.content, timestamp: m.createdAt.toISOString(),
          isBot: m.author.bot, embeds: m.embeds.map(e => ({ title: e.title, description: e.description })),
        }));
      } catch {}
      return jsonRes(res, 200, {
        orderId: order.id, serviceId: order.serviceId, serviceName: order.serviceName,
        userId: order.userId, username: order.username, channelId: order.channelId,
        price: order.price, status: order.status, createdAt: order.createdAt,
        channelName: ch.name, messages,
      });
    }

    // Send message to ticket
    if (req.method === 'POST' && p === '/api/tickets/send') {
      const d = await parseBody(req);
      const ch = guild.channels.cache.get(d.channelId);
      if (!ch || !ch.isTextBased()) return jsonRes(res, 404, { error: 'Channel not found' });
      const msg = await ch.send({ content: d.content || '' });
      return jsonRes(res, 200, { ok: true, messageId: msg.id });
    }

    // Update ticket status
    if (req.method === 'PATCH' && p.startsWith('/api/tickets/')) {
      const oid = parseInt(p.split('/')[3]);
      const orders = getOrders();
      const idx = orders.findIndex(o => o.id === oid);
      if (idx === -1) return jsonRes(res, 404, { error: 'Order not found' });
      const d = await parseBody(req);
      if (d.status) orders[idx].status = d.status;
      save('orders.json', orders);

      if (d.status === 'closed') {
        const ch = guild.channels.cache.get(orders[idx].channelId);
        if (ch) {
          try {
            const embed = new EmbedBuilder().setTitle('🔒 تم إغلاق التذكرة').setDescription('تم الإغلاق من لوحة التحكم').setColor('#E74C3C').setTimestamp();
            await ch.send({ embeds: [embed] });
          } catch {}
          setTimeout(() => { ch.delete().catch(() => {}); }, 3000);
        }
      }
      return jsonRes(res, 200, { ok: true });
    }

    jsonRes(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('API Error:', e);
    jsonRes(res, 500, { error: e.message });
  }
});

apiServer.listen(API_PORT, '127.0.0.1', () => console.log(`📡 Bot API: http://127.0.0.1:${API_PORT}`));

// ═══════════════ START ═══════════════
async function start() {
  if (!CFG.token || !CFG.clientId || !CFG.guildId) { console.log('❌ Missing config!'); return; }

  const rest = new REST({ version: '10' }).setToken(CFG.token);
  try {
    console.log('🗑️ Clearing old commands...');
    await rest.put(Routes.applicationGuildCommands(CFG.clientId, CFG.guildId), { body: [] });
    await sleep(1000);
    console.log('📝 Registering new commands...');
    await rest.put(Routes.applicationGuildCommands(CFG.clientId, CFG.guildId), { body: cmds.map(c => c.toJSON()) });
    console.log('✅ Commands registered!');
  } catch (err) { console.error('Reg error:', err); }

  await client.login(CFG.token);
}

start();
