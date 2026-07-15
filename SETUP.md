# AI Shop Bot — Setup Guide

## 1. Create Discord Application
1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it → **Create**
3. Go to **Bot** tab → click **Add Bot**
4. Enable **Message Content Intent** under Privileged Gateway Intents
5. Copy the **Bot Token**

## 2. Get IDs
1. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
2. Right-click server name → **Copy Server ID** (Guild ID)
3. Right-click your bot in member list → **Copy User ID** (Client ID)

## 3. Run the Bot
```
cd ai-shop-bot
node index.js
```
The bot will ask for:
- **Bot Token** — paste from step 1
- **Client ID** — paste from step 2
- **Server/Guild ID** — paste from step 2

## 4. Setup Server
In Discord, use the command:
```
/setup
```
This creates:
- 4 roles: 👑 Admin, ⭐ Staff, 🛒 Customer, 💎 VIP
- Categories: 📋 الخدمات, 🎫 التذاكر, 📢 الإعلانات, 💬 عام
- Channels in each category
- Rules and welcome messages

## 5. Add Services
```
/add-service name:ChatGPT Plus description:وصول ChatGPT Plus لمدة شهر price:15 category:chatgpt emoji:🤖
```

## 6. Commands

### General
| Command | Description |
|---------|-------------|
| `/services` | عرض جميع الخدمات |
| `/order [id]` | طلب خدمة |
| `/review [id] [1-5] [comment]` | إضافة تقييم |
| `/help` | عرض المساعدة |

### Admin
| Command | Description |
|---------|-------------|
| `/setup` | إعداد السيرفر تلقائياً |
| `/add-service` | إضافة خدمة |
| `/edit-service` | تعديل خدمة |
| `/delete-service` | حذف خدمة |
| `/orders` | عرض الطلبات |
| `/balance` | عرض الأرباح |
| `/config` | إعدادات البوت |

## 7. Order Flow
1. Customer runs `/order [service_id]`
2. Bot creates private ticket channel
3. Staff clicks **✅ قبول** to accept
4. Staff clicks **🏁 إتمام** when done
5. Customer gets prompted to leave a review
6. Staff clicks **🗑️ إغلاق** to close ticket

## Data Files
All data is stored in `data/` folder:
- `config.json` — bot settings
- `services.json` — all services
- `orders.json` — all orders
- `reviews.json` — all reviews
