const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadJSON(file, def = {}) { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')); } catch { return def; } }
function saveJSON(file, data) { fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf-8'); }

const config = loadJSON('config.json', { token: '', clientId: '', guildId: '', adminRoles: [], ticketCategory: null, logChannel: null, currency: '$' });

// Support Railway env vars
if (process.env.BOT_TOKEN) config.token = process.env.BOT_TOKEN;
if (process.env.CLIENT_ID) config.clientId = process.env.CLIENT_ID;
if (process.env.GUILD_ID) config.guildId = process.env.GUILD_ID;
const services = loadJSON('services.json', []);
const orders = loadJSON('orders.json', []);
const reviews = loadJSON('reviews.json', []);

function saveServices() { saveJSON('services.json', services); }
function saveOrders() { saveJSON('orders.json', orders); }
function saveReviews() { saveJSON('reviews.json', reviews); }
function saveConfig() { saveJSON('config.json', config); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] });

const commands = [
  new SlashCommandBuilder().setName('setup').setDescription('إعداد السيرفر').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('add-service').setDescription('إضافة خدمة').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('name').setDescription('الاسم').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('الوصف').setRequired(true))
    .addNumberOption(o => o.setName('price').setDescription('السعر').setRequired(true))
    .addStringOption(o => o.setName('category').setDescription('التصنيف').setRequired(true)
      .addChoices({ name: 'ChatGPT', value: 'chatgpt' }, { name: 'Image', value: 'image' }, { name: 'Voice', value: 'voice' }, { name: 'Code', value: 'code' }, { name: 'Writing', value: 'writing' }, { name: 'Data', value: 'data' }, { name: 'Other', value: 'other' }))
    .addStringOption(o => o.setName('emoji').setDescription('إيموجي')),
  new SlashCommandBuilder().setName('services').setDescription('عرض الخدمات'),
  new SlashCommandBuilder().setName('order').setDescription('طلب خدمة').addStringOption(o => o.setName('service').setDescription('رقم').setRequired(true)),
  new SlashCommandBuilder().setName('help').setDescription('المساعدة'),
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════ Setup ═══════════════

async function handleSetup(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const log = [];
  const everyone = guild.roles.everyone;

  // Delete all channels
  let chs = await guild.channels.fetch();
  for (const [, ch] of chs) {
    try { await ch.delete(); } catch(e) { log.push(`❌ ${ch.name}: ${e.message}`); }
    await sleep(1000);
  }

  // Delete all roles
  let rls = await guild.roles.fetch();
  for (const [, role] of rls) {
    if (role.name === '@everyone' || role.managed) continue;
    try { await role.delete(); } catch(e) { log.push(`❌ رول ${role.name}: ${e.message}`); }
    await sleep(1000);
  }

  await sleep(2000);

  // ══════════ Roles ══════════
  const roles = {};
  for (const rd of [
    { key: 'admin', name: '⚡⚡⚡ ┃ Admin', color: '#E74C3C', perms: [PermissionFlagsBits.Administrator] },
    { key: 'staff', name: '⭐⭐⭐ ┃ Staff', color: '#F1C40F', perms: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.SendMessages] },
    { key: 'customer', name: '🛒 ┃ Customer', color: '#1ABC9C', perms: [] },
    { key: 'vip', name: '💎 ┃ VIP', color: '#9B59B6', perms: [] },
    { key: 'bot', name: '🤖 ┃ Bot', color: '#3498DB', perms: [] },
  ]) {
    try {
      const r = await guild.roles.create({ name: rd.name, color: rd.color, permissions: rd.perms, mentionable: rd.key === 'bot' });
      roles[rd.key] = r;
      log.push(`✅ رول: ${rd.name}`);
    } catch(e) { log.push(`❌ رول ${rd.name}: ${e.message}`); }
    await sleep(800);
  }

  // Set @everyone permissions (no sending in read-only channels by default)
  try {
    await everyone.setPermissions([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
    ]);
  } catch(e) {}

  // ══════════ Categories & Channels ══════════
  const noSend = [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }];
  const fullAccess = [{ id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }];

  const structure = [
    {
      name: '╔════════ 🏪 المتجر ════════',
      channels: [
        { name: '🛒・قائمة-الخدمات', perms: fullAccess },
        { name: '📝・كيف-تطلب', perms: noSend },
        { name: '⭐・التقييمات', perms: [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }, { id: roles.customer?.id, allow: [PermissionFlagsBits.SendMessages] }] },
      ]
    },
    {
      name: '╔════════ 🎫 التذاكر ════════',
      channels: []
    },
    {
      name: '╔════════ 📢 الإعلانات ════════',
      channels: [
        { name: '📣・الإعلانات', perms: noSend },
        { name: '📋・القواعد', perms: noSend },
        { name: '🎉・العرض-والخصومات', perms: noSend },
      ]
    },
    {
      name: '╔════════ 💬 الت/chat ════════',
      channels: [
        { name: '💬・الدردشة-العامة', perms: fullAccess },
        { name: '🤖・اوامر-البوت', perms: fullAccess },
        { name: '📷・مشاركة-العمل', perms: fullAccess },
      ]
    },
    {
      name: '╔════════ 📌 معلومات ════════',
      channels: [
        { name: '📊・حالة-السيرفر', perms: noSend },
        { name: '🔗・روابط-مهمة', perms: noSend },
      ]
    },
  ];

  for (const cat of structure) {
    try {
      const c = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory });
      log.push(`✅ كاتيقوري: ${cat.name}`);
      for (const ch of cat.channels) {
        try {
          const overwrites = ch.perms.map(p => {
            const ow = { id: p.id };
            if (p.deny) ow.deny = p.deny;
            if (p.allow) ow.allow = p.allow;
            return ow;
          });
          await guild.channels.create({ name: ch.name, type: ChannelType.GuildText, parent: c.id, permissionOverwrites: overwrites });
          log.push(`✅ قناة: ${ch.name}`);
        } catch(e) { log.push(`❌ قناة ${ch.name}: ${e.message}`); }
        await sleep(800);
      }
    } catch(e) { log.push(`❌ كاتيقوري: ${e.message}`); }
    await sleep(800);
  }

  // Save ticket category
  await guild.channels.fetch();
  const ticketCat = guild.channels.cache.find(c => c.name.includes('التذاكر') && c.type === ChannelType.GuildCategory);
  if (ticketCat) { config.ticketCategory = ticketCat.id; saveConfig(); }

  // ══════════ Embeds ══════════
  await sleep(2000);
  await guild.channels.fetch();

  // Welcome
  const svcCh = guild.channels.cache.find(c => c.name.includes('قائمة-الخدمات'));
  if (svcCh) {
    try {
      const e = new EmbedBuilder()
        .setTitle('🤖 مرحباً بك في متجر الذكاء الاصطناعي')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━\n\n**مرحباً بك في أفضل متجر لخدمات الذكاء الاصطناعي!** 🚀\n\n━━━━━━━━━━━━━━━━━━━━━\n\n**الخدمات المتاحة:**\n\n🤖 **ChatGPT Plus** — محادثات ذكية لا محدودة\n🎨 **توليد الصور** — Midjourney, DALL-E 3\n💻 **برمجة** — مساعدة في أي لغة\n📝 **كتابة** — مقالات ونصوص احترافية\n📊 **تحليل بيانات** — تقارير ورسوم بيانية\n🎬 **فيديو** — تحرير وتصميم\n🔊 **صوت** — تحويل وتعديل\n\n━━━━━━━━━━━━━━━━━━━━━\n\n**💡 كيف تبدأ؟**\n\n> `1️⃣` اكتب `/services` لعرض كل الخدمات\n> `2️⃣` اختار الخدمة اللي عايزها\n> `3️⃣` اكتب `/order [رقم]` لفتح تذكرة\n> `4️⃣` ادفع واستنّى الستاف\n> `5️⃣` بعد التسليم، قيّم الخدمة!\n\n━━━━━━━━━━━━━━━━━━━━━')
        .setColor('#FF0000')
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: '🛍️ AI Shop Bot — كل شيء بالذكاء الاصطناعي' });
      await svcCh.send({ embeds: [e] });
      log.push('✅ ترحيب');
    } catch(e) { log.push('❌ ترحيب: ' + e.message); }
  }

  // Rules
  const rulesCh = guild.channels.cache.find(c => c.name.includes('القواعد'));
  if (rulesCh) {
    try {
      const e = new EmbedBuilder()
        .setTitle('📋 قواعد السيرفر')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━\n\n**📜 قوانين يجب الالتزام بها:**\n\n━━━━━━━━━━━━━━━━━━━━━\n\n**1.** 🤝 **احترام الجميع** — لا تنمر ولا سبام\n**2.** 🚫 **محتوى ممنوع** — لا محتوى مخالف أو دعائي\n**3.** 🎫 **التذاكر** — استخدم تذكرة لكل طلب منفصل\n**4.** 💰 **الدفع مقدماً** — لا نبدأ العمل قبل الدفع\n**5.** 🔒 **خصوصية** — لا تشارك حساباتك مع أحد\n**6.** 👑 **تعليمات الادمن** — اتبع إرشادات الإدارة\n**7.** ⚠️ **ال sanctions** — إنذار → ميوت → بان\n\n━━━━━━━━━━━━━━━━━━━━━\n\n> 💡 **للاستفسار:** افتح تذكرة بالaos `/order`\n> 📩 **للإبلاغ:** تواصل مع الـ Staff')
        .setColor('#FFB900')
        .setTimestamp()
        .setFooter({ text: '⚖️ قواعد السيرفر — اقراها جيداً' });
      await rulesCh.send({ embeds: [e] });
      log.push('✅ قوانين');
    } catch(e) { log.push('❌ قوانين: ' + e.message); }
  }

  // How to order
  const howCh = guild.channels.cache.find(c => c.name.includes('كيف-تطلب'));
  if (howCh) {
    try {
      const e = new EmbedBuilder()
        .setTitle('📝 دليل طلب الخدمة')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━\n\n**🎯 خطوات الطلب خطوة بخطوة:**\n\n━━━━━━━━━━━━━━━━━━━━━\n\n> `Step 1` 🛒 **اكتشف الخدمات**\n> اكتب `/services` هتظهرلك كل الخدمات بالأسعار\n\n> `Step 2` 🎯 **اختار اللي يناسبك**\n> اختار الخدمة من القائمة واتذكر رقمها\n\n> `Step 3` 🎫 **افتح تذكرة**\n> اكتب `/order [رقم الخدمة]`\n> هتتفتحلك قناة خاصة في كاتيقوري التذاكر\n\n> `Step 4` 💬 **تواصل مع الستاف**\n> ا explaining طلبك جوا التذكرة\n> الستاف هيكمّلوك التفاصيل\n\n> `Step 5` 💰 **ادفع**\n> بعد الاتفاق على التفاصيل، ادفع\n> الستاف يبدأ فوراً في العمل\n\n> `Step 6` ✅ **استلم وقيّم**\n> بعد التسليم، اكتب `/review [رقم] [1-5]`\n> تقييمك يساعدنا نتحسن!\n\n━━━━━━━━━━━━━━━━━━━━━')
        .setColor('#2ECC71')
        .setTimestamp()
        .setFooter({ text: '📖 دليل الطلب الشامل' });
      await howCh.send({ embeds: [e] });
      log.push('✅ كيف تطلب');
    } catch(e) { log.push('❌ كيف تطلب: ' + e.message); }
  }

  // Announcements channel
  const annCh = guild.channels.cache.find(c => c.name.includes('الإعلانات'));
  if (annCh) {
    try {
      const e = new EmbedBuilder()
        .setTitle('📣 مرحباً بالجميع!')
        .setDescription('**هنا هتلاقي أحدث الإعلانات والعروض والخصومات!** 🔔\n\n-follow this channel عشان يوصلك كل جديد')
        .setColor('#E74C3C')
        .setTimestamp()
        .setFooter({ text: '📢 الإعلانات' });
      await annCh.send({ embeds: [e] });
      log.push('✅ إعلانات');
    } catch(e) {}
  }

  // Offers channel
  const offersCh = guild.channels.cache.find(c => c.name.includes('العرض'));
  if (offersCh) {
    try {
      const e = new EmbedBuilder()
        .setTitle('🎉 العروض والخصومات')
        .setDescription('**تابع هذه القناة عشان تعرف أحدث العروض والخصومات!** 🏷️\n\nخصومات تصل إلى **50%** على بعض الخدمات!')
        .setColor('#FF6B6B')
        .setTimestamp()
        .setFooter({ text: '🏷️ العروض والخصومات' });
      await offersCh.send({ embeds: [e] });
      log.push('✅ عروض');
    } catch(e) {}
  }

  await interaction.editReply(`✅ تم الإعداد الكامل!\n\n${log.join('\n')}`);
}

// ═══════════════ Services ═══════════════

async function handleAddService(interaction) {
  const name = interaction.options.getString('name');
  const desc = interaction.options.getString('description');
  const price = interaction.options.getNumber('price');
  const category = interaction.options.getString('category');
  const emoji = interaction.options.getString('emoji') || '🤖';
  const id = services.length > 0 ? Math.max(...services.map(s => s.id)) + 1 : 1;
  services.push({ id, name, description: desc, price, category, emoji, active: true, createdAt: Date.now() });
  saveServices();
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`${emoji} ${name}`).setDescription(desc).addFields({ name: '💰 السعر', value: `${config.currency}${price}`, inline: true }, { name: '📂 التصنيف', value: category, inline: true }).setColor('#2d6a4f').setTimestamp()], ephemeral: true });
}

async function handleServices(interaction) {
  const cats = {};
  for (const s of services.filter(s => s.active)) {
    if (!cats[s.category]) cats[s.category] = [];
    cats[s.category].push(s);
  }
  if (!Object.keys(cats).length) return interaction.reply({ content: '📭 لا توجد خدمات', ephemeral: true });
  const embed = new EmbedBuilder().setTitle('🛒 الخدمات').setColor('#FF0000').setTimestamp();
  for (const [cat, items] of Object.entries(cats)) {
    embed.addFields({ name: cat, value: items.map(s => `${s.emoji} **${s.name}** — ${config.currency}${s.price}`).join('\n') });
  }
  await interaction.reply({ embeds: [embed] });
}

async function handleOrder(interaction) {
  const id = parseInt(interaction.options.getString('service'));
  const service = services.find(s => s.id === id && s.active);
  if (!service) return interaction.reply({ content: '❌ خدمة غير موجودة', ephemeral: true });
  const guild = interaction.guild, user = interaction.user;
  const ticketCat = config.ticketCategory ? guild.channels.cache.get(config.ticketCategory) : null;
  const channel = await guild.channels.create({
    name: `ticket-${user.username}-${service.id}`,
    type: ChannelType.GuildText,
    parent: ticketCat?.id || null,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ],
  });
  const orderId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1;
  orders.push({ id: orderId, serviceId: service.id, serviceName: service.name, userId: user.id, username: user.username, channelId: channel.id, price: service.price, status: 'pending', createdAt: Date.now() });
  saveOrders();
  const embed = new EmbedBuilder().setTitle(`🎫 طلب #${orderId}`).setDescription(`**الخدمة:** ${service.emoji} ${service.name}\n**العميل:** ${user}\n**السعر:** ${config.currency}${service.price}\n**الحالة:** ⏳`).setColor('#FFB900').setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`order_accept_${orderId}`).setLabel('✅ قبول').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`order_complete_${orderId}`).setLabel('🏁 إتمام').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Secondary),
  );
  await channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ تم فتح التذكرة: ${channel}`, ephemeral: true });
}

async function handleHelp(interaction) {
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🤖 الأوامر').addFields({ name: 'عامة', value: '`/services` `/order` `/help`' }, { name: 'إدارة', value: '`/setup` `/add-service`' }).setColor('#FF0000')], ephemeral: true });
}

// ═══════════════ Handler ═══════════════

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      console.log(`Command: ${commandName}`);
      if (commandName === 'setup') await handleSetup(interaction);
      else if (commandName === 'add-service') await handleAddService(interaction);
      else if (commandName === 'services') await handleServices(interaction);
      else if (commandName === 'order') await handleOrder(interaction);
      else if (commandName === 'help') await handleHelp(interaction);
    } else if (interaction.isButton() && interaction.customId.startsWith('order_')) {
      const [, type, idStr] = interaction.customId.split('_');
      const orderId = parseInt(idStr);
      const order = orders.find(o => o.id === orderId);
      if (!order) return interaction.reply({ content: '❌', ephemeral: true });
      if (type === 'accept') { order.status = 'progress'; saveOrders(); await interaction.reply({ content: `✅ قبل ${interaction.user}` }); }
      else if (type === 'complete') { order.status = 'completed'; saveOrders(); await interaction.reply({ content: '🏁 تم!' }); }
      else if (type === 'close') { order.status = 'closed'; saveOrders(); await interaction.reply({ content: '🗑️ إغلاق...' }); setTimeout(() => { const c = interaction.guild.channels.cache.get(order.channelId); if (c) c.delete().catch(() => {}); }, 2000); }
    }
  } catch (err) {
    console.error('Error:', err);
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ خطأ', ephemeral: true }).catch(() => {});
  }
});

client.on('ready', () => {
  console.log(`✅ Bot: ${client.user.tag} | ${client.guilds.cache.size} servers`);
  client.user.setActivity('AI Services Shop', { type: 3 });
});

// Auto-assign Customer role to new members
client.on('guildMemberAdd', async (member) => {
  try {
    const role = member.guild.roles.cache.find(r => r.name.includes('Customer'));
    if (role) {
      await member.roles.add(role);
      console.log(`✅ Assigned Customer role to ${member.user.tag}`);
    }
  } catch(e) {
    console.error('Role assign error:', e.message);
  }
});

async function start() {
  if (!config.token || !config.clientId || !config.guildId) {
    console.log('Missing config!');
    return;
  }
  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    console.log('Registering...');
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands.map(c => c.toJSON()) });
    console.log('✅ Registered!');
  } catch (err) { console.error('Reg error:', err); }
  await client.login(config.token);
}

start();
