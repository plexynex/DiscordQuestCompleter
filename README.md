# 🎮 Discord Quest Completer (PC/Laptop)

Panduan untuk menyelesaikan Quest Discord menggunakan Developer Tools.

---

## 📋 Langkah-langkah

### 1. Aktifkan Developer Mode
- Buka **Settings** > **Advanced**
- Aktifkan **Developer Mode** (*ON*)
- Buka folder Discord dengan menekan **Windows + R**, lalu ketik:
  ```
  %appdata%/discord/
  ```

---

### 2. Edit File `settings.json`
- Buka file `settings.json` menggunakan **Notepad**
- Ganti **seluruh isinya** dengan teks berikut:

```json
{
  "IS_MAXIMIZED": true,
  "WINDOW_BOUNDS": {
    "x": 112,
    "y": 60,
    "width": 1284,
    "height": 724
  },
  "MIN_WIDTH": 940,
  "MIN_HEIGHT": 500,
  "BACKGROUND_COLOR": "#121214",
  "DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING": true
}
```

- Setelah selesai, **tutup Discord sepenuhnya**:
  - Tekan `Ctrl + Shift + Esc`
  - Klik kanan pada **Discord** > **End Task** / **End Process**

---

### 3. Buka Kembali Discord
- Jalankan Discord seperti biasa
- Tekan **`Ctrl + Shift + I`** untuk membuka Developer Tools

---

### 4. Jalankan Kode di Console
- Pilih tab **Console** (di bagian kanan atas)
- Scroll ke bawah, lalu masukkan seluruh kode berikut 📃 **[Copy Kode Quest Completer](main-code-update-v11)**
- Tekan **Enter** untuk menjalankan

---

## ⚠️ Disclaimer
Gunakan dengan bijak dan sesuai ketentuan Discord. Segala risiko ditanggung sendiri.

---

# 🔧 Discord Quest Completer - Dokumentasi Teknis & Troubleshooting

Dokumentasi detail tentang cara kerja script, alur eksekusi, dan panduan mengatasi masalah yang mungkin terjadi.

---

## Daftar Isi
- [Arsitektur & Cara Kerja](#-arsitektur--cara-kerja)
- [Alur Eksekusi Detail](#-alur-eksekusi-detail)
- [FAQ (Frequently Asked Questions)](#-faq-frequently-asked-questions)
- [Troubleshooting](#-troubleshooting)
- [Error & Solusi](#-error--solusi)

---

## 🏗️ Arsitektur & Cara Kerja

### 1. Inisialisasi Webpack
```javascript
delete window.$;
let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
webpackChunkdiscord_app.pop();
```
- **Tujuan:** Mengakses internal module Discord yang tidak diekspos secara publik
- `window.$` dihapus untuk mencegah konflik dengan jQuery (jika ada)
- Teknik **Webpack chunk injection** digunakan untuk mendapatkan fungsi `require` internal Discord
- `push` dengan symbol unik + callback `r => r` mengembalikan fungsi require asli
- `pop` membersihkan chunk dummy yang baru saja dimasukkan

### 2. Ekstraksi Module Internal
```javascript
let ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata).exports.A;
```
Setiap module dicari dengan cara:
- `wpRequire.c` berisi **seluruh module cache** Discord
- `Object.values()` mengubah object cache menjadi array
- `.find()` mencari module yang memiliki method/property spesifik di prototype-nya
- `.exports.A` atau `.exports.Ay` mengambil instance store yang aktif

#### Module yang Diekstrak & Fungsinya:

| Module | Method/Property Kunci | Fungsi |
|--------|----------------------|--------|
| `ApplicationStreamingStore` | `getStreamerActiveStreamMetadata` | Menyimpan & mengambil data stream aktif user |
| `RunningGameStore` | `getRunningGames` | Mendeteksi game yang sedang berjalan di sistem |
| `QuestsStore` | `getQuest` | Menyimpan seluruh data quest user |
| `ChannelStore` | `getAllThreadsForParent` | Mengelola channel private & group DM |
| `GuildChannelStore` | `getSFWDefaultChannel` | Mengelola channel dalam server/guild |
| `FluxDispatcher` | `flushWaitQueue` | Event dispatcher utama Discord (Flux pattern) |
| `api` | `get` | HTTP client untuk request ke Discord API |

### 3. Filter Quest yang Valid
```javascript
const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"]
let quests = [...QuestsStore.quests.values()].filter(x => 
    x.userStatus?.enrolledAt &&           // User sudah enroll quest
    !x.userStatus?.completedAt &&         // Quest belum selesai
    new Date(x.config.expiresAt).getTime() > Date.now() &&  // Belum expired
    supportedTasks.find(y => Object.keys((x.config.taskConfig ?? x.config.taskConfigV2).tasks).includes(y))  // Task type didukung
)
```

Kriteria quest yang diproses:
1. **Sudah di-enroll** (`enrolledAt` tidak null)
2. **Belum selesai** (`completedAt` null/undefined)
3. **Tidak expired** (expiresAt > waktu sekarang)
4. **Task type didukung** oleh script

### 4. Deteksi Platform
```javascript
let isApp = typeof DiscordNative !== "undefined"
```
- `DiscordNative` hanya ada di **Desktop App** (Electron)
- Jika `undefined` = Web Browser
- Digunakan untuk validasi quest `PLAY_ON_DESKTOP` & `STREAM_ON_DESKTOP`

---

## 🔄 Alur Eksekusi Detail

### 📊 Flowchart Umum
```
Start
  │
  ├─ Filter quest valid
  │
  ├─ Iterasi quest satu per satu (doJob recursion)
  │
  ├─ Deteksi task type
  │
  ├─ WATCH_VIDEO/WATCH_VIDEO_ON_MOBILE
  │   ├─ Hitung max allowed timestamp
  │   ├─ Loop kirim fake progress tiap 1 detik
  │   ├─ Speed 7x lipat dari real-time
  │   ├─ Max future buffer: 10 detik
  │   └─ Akhiri dengan timestamp = target
  │
  ├─ PLAY_ON_DESKTOP
  │   ├─ Cek platform (harus Desktop)
  │   ├─ Fetch aplikasi dari API
  │   ├─ Buat fake game object
  │   ├─ Override RunningGameStore
  │   ├─ Dispatch RUNNING_GAMES_CHANGE
  │   ├─ Subscribe QUESTS_SEND_HEARTBEAT_SUCCESS
  │   └─ Cleanup setelah selesai
  │
  ├─ STREAM_ON_DESKTOP
  │   ├─ Cek platform (harus Desktop)
  │   ├─ Override getStreamerActiveStreamMetadata
  │   ├─ Subscribe heartbeat
  │   └─ Cleanup + restore function asli
  │
  └─ PLAY_ACTIVITY
      ├─ Cari channel yang tersedia
      ├─ Generate stream_key
      ├─ Loop kirim heartbeat tiap 20 detik
      ├─ Kirim terminal=true saat selesai
      └─ Tidak perlu fake game/stream
```

---

### 🎬 Detail: WATCH_VIDEO / WATCH_VIDEO_ON_MOBILE

#### Mekanisme Spoofing Video Progress
```javascript
const maxFuture = 10, speed = 7, interval = 1
const enrolledAt = new Date(quest.userStatus.enrolledAt).getTime()
```

**Parameter:**
- `maxFuture = 10`: Progress tidak boleh lebih dari (waktu sekarang - waktu enroll + 10 detik)
- `speed = 7`: Setiap iterasi menambah progress 7 detik
- `interval = 1`: Kirim request setiap 1 detik

**Rumus Progress:**
```
maxAllowed = (waktu_sekarang - waktu_enroll) + 10 detik
progress   = min(target, progress_sebelumnya + 7 + random)
```

**Validasi Server:**
Server Discord memvalidasi bahwa timestamp yang dikirim tidak boleh:
- Lebih besar dari target quest
- Terlalu jauh di depan waktu real-time (ada buffer ~10 detik)

#### Loop Eksekusi
```javascript
while(true) {
    const maxAllowed = Math.floor((Date.now() - enrolledAt)/1000) + maxFuture
    const diff = maxAllowed - secondsDone
    const timestamp = secondsDone + speed
    
    if(diff >= speed) {
        const res = await api.post({
            url: `/quests/${quest.id}/video-progress`, 
            body: {timestamp: Math.min(secondsNeeded, timestamp + Math.random())}
        })
        completed = res.body.completed_at != null
        secondsDone = Math.min(secondsNeeded, timestamp)
    }
    
    if(timestamp >= secondsNeeded) break
    await new Promise(resolve => setTimeout(resolve, interval * 1000))
}
```

**Mengapa ada `Math.random()`?**
- Menambahkan variasi kecil pada timestamp
- Menghindari deteksi pola pengiriman yang terlalu rapi
- Membuat progress terlihat lebih natural

**Final Request:**
```javascript
if(!completed) {
    await api.post({
        url: `/quests/${quest.id}/video-progress`, 
        body: {timestamp: secondsNeeded}
    })
}
```
- Jika setelah loop belum completed, kirim timestamp tepat di target
- Memastikan quest benar-benar selesai

**Estimasi Waktu:**
- Video 3 menit (180 detik) selesai dalam ~26 detik real-time
- Video 5 menit (300 detik) selesai dalam ~43 detik real-time

---

### 🎮 Detail: PLAY_ON_DESKTOP

#### Langkah 1: Fetch Data Aplikasi
```javascript
api.get({url: `/applications/public?application_ids=${applicationId}`}).then(res => {
    const appData = res.body[0]
    const exeName = appData.executables?.find(x => x.os === "win32")?.name?.replace(">","") 
                    ?? appData.name.replace(/[\/\\:*?"<>|]/g, "")
```
- Mengambil data aplikasi dari Discord API
- Mencari executable Windows (win32)
- Membersihkan karakter ilegal dari nama file

#### Langkah 2: Fake Game Object
```javascript
const fakeGame = {
    cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
    exeName,
    exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
    hidden: false,
    isLauncher: false,
    id: applicationId,
    name: appData.name,
    pid: pid,              // Random PID antara 1000-31000
    pidPath: [pid],
    processName: appData.name,
    start: Date.now(),
}
```
- PID dibuat random: `Math.floor(Math.random() * 30000) + 1000`
- Path dan nama disesuaikan dengan data asli aplikasi

#### Langkah 3: Override Store
```javascript
const realGames = RunningGameStore.getRunningGames()
const fakeGames = [fakeGame]
const realGetRunningGames = RunningGameStore.getRunningGames
const realGetGameForPID = RunningGameStore.getGameForPID

// Override
RunningGameStore.getRunningGames = () => fakeGames
RunningGameStore.getGameForPID = (pid) => fakeGames.find(x => x.pid === pid)

// Dispatch event
FluxDispatcher.dispatch({
    type: "RUNNING_GAMES_CHANGE", 
    removed: realGames, 
    added: [fakeGame], 
    games: fakeGames
})
```
- Menyimpan referensi fungsi asli
- Mengganti fungsi dengan versi fake
- Dispatch event agar UI Discord terupdate

#### Langkah 4: Progress Tracking
```javascript
let fn = data => {
    let progress = quest.config.configVersion === 1 
        ? data.userStatus.streamProgressSeconds 
        : Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value)
    
    console.log(`Quest progress: ${progress}/${secondsNeeded}`)
    
    if(progress >= secondsNeeded) {
        // Cleanup & restore
        RunningGameStore.getRunningGames = realGetRunningGames
        RunningGameStore.getGameForPID = realGetGameForPID
        FluxDispatcher.dispatch({
            type: "RUNNING_GAMES_CHANGE", 
            removed: [fakeGame], 
            added: [], 
            games: []
        })
        FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
        doJob()
    }
}
FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
```
- Subscribe ke event heartbeat sukses
- Tracking progress dari response heartbeat
- **Config v1:** `streamProgressSeconds`
- **Config v2:** `progress.PLAY_ON_DESKTOP.value`
- Setelah selesai: restore fungsi asli & unsubscribe

**Mengapa harus Desktop App?**
- Browser tidak memiliki akses ke running processes sistem
- `DiscordNative` diperlukan untuk integrasi OS-level
- Override store hanya efektif di environment Electron

---

### 📡 Detail: STREAM_ON_DESKTOP

#### Override Stream Metadata
```javascript
let realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata
ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
    id: applicationId,
    pid,
    sourceName: null
})
```
- Memalsukan data stream aktif
- `id`: Application ID quest
- `pid`: Process ID acak
- `sourceName`: null (tidak ada window spesifik)

#### Persyaratan Khusus
> ⚠️ **WAJIB:** Minimal 1 orang lain di Voice Channel!
- Discord memvalidasi jumlah partisipan VC
- Jika sendiri, heartbeat akan ditolak
- Progress tidak akan bertambah

#### Cleanup
```javascript
if(progress >= secondsNeeded) {
    ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc
    FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
    doJob()
}
```
- Mengembalikan fungsi asli
- Unsubscribe dari event

---

### 🕹️ Detail: PLAY_ACTIVITY

#### Pencarian Channel
```javascript
const channelId = ChannelStore.getSortedPrivateChannels()[0]?.id 
    ?? Object.values(GuildChannelStore.getAllGuilds())
        .find(x => x != null && x.VOCAL.length > 0)
        .VOCAL[0].channel.id
```

**Prioritas channel:**
1. Private channel (DM/Group) pertama yang tersedia
2. Voice channel pertama dari guild manapun
3. Gunakan nullish coalescing (`??`) untuk fallback

#### Stream Key Format
```javascript
const streamKey = `call:${channelId}:1`
```
Format: `call:[channel_id]:1`
- Prefix `call:` menandakan voice call
- `channelId`: ID channel target
- `1`: Versi stream key

#### Heartbeat Loop
```javascript
let fn = async () => {
    console.log("Completing quest", questName, "-", quest.config.messages.questName)
    
    while(true) {
        const res = await api.post({
            url: `/quests/${quest.id}/heartbeat`, 
            body: {stream_key: streamKey, terminal: false}
        })
        const progress = res.body.progress.PLAY_ACTIVITY.value
        console.log(`Quest progress: ${progress}/${secondsNeeded}`)
        
        await new Promise(resolve => setTimeout(resolve, 20 * 1000))
        
        if(progress >= secondsNeeded) {
            await api.post({
                url: `/quests/${quest.id}/heartbeat`, 
                body: {stream_key: streamKey, terminal: true}
            })
            break
        }
    }
    
    console.log("Quest completed!")
    doJob()
}
```

**Parameter Heartbeat:**
- `terminal: false` = Progress masih berjalan
- `terminal: true` = Menandakan selesai
- Interval: 20 detik antar request
- Progress diambil dari `res.body.progress.PLAY_ACTIVITY.value`

**Keunggulan PLAY_ACTIVITY:**
- Tidak perlu fake game/stream
- Tidak perlu VC (bisa sendiri)
- Bekerja di browser & desktop
- Paling sederhana dan cepat

---

## ❓ FAQ (Frequently Asked Questions)

### Q1: Apakah script ini aman digunakan?
**A:** Script ini bekerja dengan cara:
- ✅ Tidak mengubah file sistem
- ✅ Tidak mencuri data/token
- ✅ Hanya memanipulasi runtime JavaScript
- ✅ Tidak meninggalkan perubahan permanen
- ⚠️ Namun melanggar ToS Discord (gunakan dengan risiko sendiri)

### Q2: Kenapa quest saya tidak terdeteksi?
**A:** Beberapa kemungkinan:
1. **Belum enroll quest** - Buka Quest dan klik "Accept Quest"
2. **Quest expired** - Cek tanggal kadaluarsa
3. **Task type tidak didukung** - Cek apakah termasuk 5 tipe yang didukung
4. **Quest sudah selesai** - Cek `completedAt` status

### Q3: Berapa lama waktu yang dibutuhkan?
**Estimasi per tipe quest:**

| Tipe | Target 1 Menit | Target 5 Menit | Target 15 Menit |
|------|---------------|----------------|-----------------|
| WATCH_VIDEO | ~9 detik | ~43 detik | ~2 menit 9 detik |
| PLAY_ON_DESKTOP | ~1 menit | ~5 menit | ~15 menit |
| STREAM_ON_DESKTOP | ~1 menit | ~5 menit | ~15 menit |
| PLAY_ACTIVITY | ~1 menit | ~5 menit | ~15 menit |

> **Catatan:** Hanya `WATCH_VIDEO` yang bisa dipercepat. Tipe lain berjalan real-time karena bergantung heartbeat server.

### Q4: Kenapa PLAY_ON_DESKTOP/STREAM_ON_DESKTOP harus pakai Desktop App?
**A:** Karena:
- Script perlu akses `DiscordNative` (hanya ada di Electron)
- Browser tidak bisa mendeteksi/memalsukan running processes
- Override `RunningGameStore` hanya berfungsi di environment Desktop

### Q5: Apakah perlu VC (Voice Channel) untuk STREAM_ON_DESKTOP?
**A:** **YA, WAJIB!**
- Harus ada **minimal 1 orang lain** di VC
- Server Discord memvalidasi jumlah partisipan
- Tidak cukup hanya join VC sendiri

### Q6: Kenapa progress tidak bertambah padahal script berjalan?
**A:** Cek hal berikut:
1. **Console log** - Ada error?
2. **Koneksi internet** - Heartbeat gagal terkirim?
3. **Quest type salah** - Cek task type yang terdeteksi
4. **Sudah selesai?** - Refresh dan cek Quest
5. **Rate limited?** - Tunggu beberapa menit

### Q7: Apakah script bisa menyelesaikan multiple quest sekaligus?
**A:** Ya, script akan:
1. Mengumpulkan semua quest valid
2. Memproses satu per satu (sequential)
3. `doJob()` dipanggil rekursif setelah quest selesai
4. Tidak parallel - untuk menghindari deteksi

### Q8: Kenapa ada random di timestamp video?
**A:** Untuk:
- Menghindari pola progress yang terlalu sempurna
- Mensimulasikan perilaku menonton natural
- Mengurangi risiko deteksi server-side

### Q9: Apakah perlu edit settings.json setiap kali?
**A:** **Tidak.** Hanya perlu sekali untuk mengaktifkan DevTools. Setelah itu DevTools akan tetap aktif sampai di-disable.

### Q10: Bagaimana cara script mendeteksi config version?
**A:** Script otomatis mendeteksi:
```javascript
quest.config.configVersion === 1 
    ? data.userStatus.streamProgressSeconds 
    : Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value)
```
- **v1:** Progress di `streamProgressSeconds`
- **v2:** Progress di `progress.[TASK_TYPE].value`

---

## 🔧 Troubleshooting

### Masalah 1: "Cannot read properties of undefined" saat buka Console
**Penyebab:** DevTools belum diaktifkan atau Discord belum direstart.

**Solusi:**
1. Cek kembali `settings.json` - pastikan isinya benar
2. Pastikan Discord benar-benar tertutup (End Task)
3. Buka ulang Discord
4. Jika masih error, ulangi dari langkah 1

---

### Masalah 2: Console menampilkan peringatan kuning/merah
**Penyebab:** Discord menampilkan warning keamanan.

**Solusi:**
1. Abaikan warning (bukan error)
2. Ketik `allow pasting` jika diminta
3. Paste dan jalankan kode seperti biasa

---

### Masalah 3: "You don't have any uncompleted quests!"
**Penyebab:** Tidak ada quest yang memenuhi kriteria.

**Cek:**
- [ ] Sudah enroll quest?
- [ ] Quest belum selesai?
- [ ] Quest belum expired?
- [ ] Tipe quest didukung? (Cek daftar 5 tipe)

---

### Masalah 4: Script stuck tanpa progress
**Penyebab umum & solusi:**

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| Tidak ada log sama sekali | Script error | Refresh & jalankan ulang |
| Progress 0 terus | Heartbeat gagal | Cek koneksi, restart Discord |
| Stuck di tengah | Rate limited | Tunggu 5-10 menit |
| Error 403/401 | Token expired | Logout & login ulang |

---

### Masalah 5: PLAY_ON_DESKTOP tidak bekerja di browser
**Penyebab:** Memang tidak didukung.

**Solusi:** 
1. Download & install Discord Desktop App
2. Login dengan akun yang sama
3. Jalankan script di Desktop App

---

### Masalah 6: STREAM_ON_DESKTOP progress tidak naik
**Penyebab:** Tidak ada orang lain di VC.

**Solusi:**
1. Ajak minimal 1 teman join VC
2. Nyalakan stream (bisa stream window kosong)
3. Tunggu heartbeat terkirim (ada log di console)

---

### Masalah 7: Muncul error "ERR_BLOCKED_BY_CLIENT"
**Penyebab:** Adblock atau antivirus memblokir request.

**Solusi:**
1. Matikan adblock untuk Discord
2. Tambahkan Discord ke whitelist antivirus
3. Gunakan mode incognito (untuk browser)

---

### Masalah 8: Tidak bisa paste di Console
**Penyebab:** Discord memblokir paste untuk keamanan.

**Solusi:**
1. Ketik: `allow pasting`
2. Tekan Enter
3. Sekarang bisa paste kode

---

### Masalah 9: Script selesai tapi hadiah belum muncul
**Penyebab:** UI Discord belum terupdate.

**Solusi:**
1. Tekan `Ctrl + R` untuk refresh
2. Buka Quest
3. Jika masih belum muncul, tunggu 5-10 menit
4. Coba restart Discord

---

### Masalah 10: Error "TypeError: Cannot read properties of undefined (reading 'getQuest')"
**Penyebab:** Struktur module Discord berubah (update Discord).

**Solusi:**
1. Cek apakah ada update script terbaru
2. Discord mungkin mengubah internal module
3. Cari versi script terbaru dari sumber terpercaya
4. Laporkan issue ke pembuat script

---

## 🚨 Error & Solusi

### Error Code Reference

| Error | Arti | Solusi |
|-------|------|--------|
| `401 Unauthorized` | Token tidak valid | Login ulang |
| `403 Forbidden` | Tidak punya akses | Cek apakah quest masih tersedia |
| `429 Too Many Requests` | Rate limited | Tunggu 5-15 menit |
| `500 Internal Server Error` | Server Discord error | Coba lagi nanti |
| `TypeError: undefined is not a function` | Module Discord berubah | Update script |
| `ReferenceError: DiscordNative is not defined` | Bukan Desktop App | Ganti ke Desktop App |

### Debug Mode
Untuk melihat lebih detail apa yang terjadi, tambahkan log:
```javascript
console.log("Detected quests:", quests)
console.log("Task type:", taskName)
console.log("Platform:", isApp ? "Desktop" : "Browser")
console.log("Config version:", quest.config.configVersion)
```

---

## 📝 Catatan Penting

1. **Gunakan dengan bijak** - Abuse dapat menyebabkan akun di-banned
2. **Jangan bagikan token** - Script tidak mencuri data, tapi tetap waspada
3. **Update script** - Discord sering update internal module
4. **Backup settings.json** - Simpan original settings sebelum edit
5. **Gunakan akun throwaway** - Jika ragu, jangan gunakan akun utama

---

## 🔗 Referensi Teknis

### Discord Internal Systems
- **Flux Pattern:** Discord menggunakan Flux untuk state management
- **Webpack Modules:** Internal module di-bundle dengan Webpack
- **Store System:** Setiap fitur memiliki Store sendiri (QuestsStore, RunningGameStore, dll)
- **Heartbeat System:** Progress quest dikirim via heartbeat berkala

### API Endpoints Used
```
GET  /applications/public?application_ids={id}
POST /quests/{questId}/video-progress
POST /quests/{questId}/heartbeat
```

---

*Dokumentasi ini dibuat untuk tujuan edukasi. Segala risiko penggunaan ditanggung sendiri.*

---

## Main Code
```js
delete window.$;
let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
webpackChunkdiscord_app.pop();

let ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata).exports.A;
let RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getRunningGames).exports.Ay;
let QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest).exports.A;
let ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent).exports.A;
let GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getSFWDefaultChannel).exports.Ay;
let FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.h?.__proto__?.flushWaitQueue).exports.h;
let api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get).exports.Bo;

const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"]
let quests = [...QuestsStore.quests.values()].filter(x => x.userStatus?.enrolledAt && !x.userStatus?.completedAt && new Date(x.config.expiresAt).getTime() > Date.now() && supportedTasks.find(y => Object.keys((x.config.taskConfig ?? x.config.taskConfigV2).tasks).includes(y)))
let isApp = typeof DiscordNative !== "undefined"
if(quests.length === 0) {
	console.log("You don't have any uncompleted quests!")
} else {
	let doJob = function() {
		const quest = quests.pop()
		if(!quest) return

		const pid = Math.floor(Math.random() * 30000) + 1000
		
		const applicationId = quest.config.application.id
		const applicationName = quest.config.application.name
		const questName = quest.config.messages.questName
		const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2
		const taskName = supportedTasks.find(x => taskConfig.tasks[x] != null)
		const secondsNeeded = taskConfig.tasks[taskName].target
		let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0

		if(taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
			const maxFuture = 10, speed = 7, interval = 1
			const enrolledAt = new Date(quest.userStatus.enrolledAt).getTime()
			let completed = false
			let fn = async () => {			
				while(true) {
					const maxAllowed = Math.floor((Date.now() - enrolledAt)/1000) + maxFuture
					const diff = maxAllowed - secondsDone
					const timestamp = secondsDone + speed
					if(diff >= speed) {
						const res = await api.post({url: `/quests/${quest.id}/video-progress`, body: {timestamp: Math.min(secondsNeeded, timestamp + Math.random())}})
						completed = res.body.completed_at != null
						secondsDone = Math.min(secondsNeeded, timestamp)
					}
					
					if(timestamp >= secondsNeeded) {
						break
					}
					await new Promise(resolve => setTimeout(resolve, interval * 1000))
				}
				if(!completed) {
					await api.post({url: `/quests/${quest.id}/video-progress`, body: {timestamp: secondsNeeded}})
				}
				console.log("Quest completed!")
				doJob()
			}
			fn()
			console.log(`Spoofing video for ${questName}.`)
		} else if(taskName === "PLAY_ON_DESKTOP") {
			if(!isApp) {
				console.log("This no longer works in browser for non-video quests. Use the discord desktop app to complete the", questName, "quest!")
			} else {
				api.get({url: `/applications/public?application_ids=${applicationId}`}).then(res => {
					const appData = res.body[0]
					const exeName = appData.executables?.find(x => x.os === "win32")?.name?.replace(">","") ?? appData.name.replace(/[\/\\:*?"<>|]/g, "")
					
					const fakeGame = {
						cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
						exeName,
						exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
						hidden: false,
						isLauncher: false,
						id: applicationId,
						name: appData.name,
						pid: pid,
						pidPath: [pid],
						processName: appData.name,
						start: Date.now(),
					}
					const realGames = RunningGameStore.getRunningGames()
					const fakeGames = [fakeGame]
					const realGetRunningGames = RunningGameStore.getRunningGames
					const realGetGameForPID = RunningGameStore.getGameForPID
					RunningGameStore.getRunningGames = () => fakeGames
					RunningGameStore.getGameForPID = (pid) => fakeGames.find(x => x.pid === pid)
					FluxDispatcher.dispatch({type: "RUNNING_GAMES_CHANGE", removed: realGames, added: [fakeGame], games: fakeGames})
					
					let fn = data => {
						let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value)
						console.log(`Quest progress: ${progress}/${secondsNeeded}`)
						
						if(progress >= secondsNeeded) {
							console.log("Quest completed!")
							
							RunningGameStore.getRunningGames = realGetRunningGames
							RunningGameStore.getGameForPID = realGetGameForPID
							FluxDispatcher.dispatch({type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: []})
							FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
							
							doJob()
						}
					}
					FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
					
					console.log(`Spoofed your game to ${applicationName}. Wait for ${Math.ceil((secondsNeeded - secondsDone) / 60)} more minutes.`)
				})
			}
		} else if(taskName === "STREAM_ON_DESKTOP") {
			if(!isApp) {
				console.log("This no longer works in browser for non-video quests. Use the discord desktop app to complete the", questName, "quest!")
			} else {
				let realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata
				ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
					id: applicationId,
					pid,
					sourceName: null
				})
				
				let fn = data => {
					let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.STREAM_ON_DESKTOP.value)
					console.log(`Quest progress: ${progress}/${secondsNeeded}`)
					
					if(progress >= secondsNeeded) {
						console.log("Quest completed!")
						
						ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc
						FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
						
						doJob()
					}
				}
				FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
				
				console.log(`Spoofed your stream to ${applicationName}. Stream any window in vc for ${Math.ceil((secondsNeeded - secondsDone) / 60)} more minutes.`)
				console.log("Remember that you need at least 1 other person to be in the vc!")
			}
		} else if(taskName === "PLAY_ACTIVITY") {
			const channelId = ChannelStore.getSortedPrivateChannels()[0]?.id ?? Object.values(GuildChannelStore.getAllGuilds()).find(x => x != null && x.VOCAL.length > 0).VOCAL[0].channel.id
			const streamKey = `call:${channelId}:1`
			
			let fn = async () => {
				console.log("Completing quest", questName, "-", quest.config.messages.questName)
				
				while(true) {
					const res = await api.post({url: `/quests/${quest.id}/heartbeat`, body: {stream_key: streamKey, terminal: false}})
					const progress = res.body.progress.PLAY_ACTIVITY.value
					console.log(`Quest progress: ${progress}/${secondsNeeded}`)
					
					await new Promise(resolve => setTimeout(resolve, 20 * 1000))
					
					if(progress >= secondsNeeded) {
						await api.post({url: `/quests/${quest.id}/heartbeat`, body: {stream_key: streamKey, terminal: true}})
						break
					}
				}
				
				console.log("Quest completed!")
				doJob()
			}
			fn()
		}
	}
	doJob()
}
```

## Main Code (UPDATE V1.1)
```js
delete window.$;
let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
webpackChunkdiscord_app.pop();

let ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata).exports.A;
let RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getRunningGames).exports.Ay;
let QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest).exports.A;
let ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent).exports.A;
let GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getSFWDefaultChannel).exports.Ay;
let FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.h?.__proto__?.flushWaitQueue).exports.h;
let api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get).exports.Bo;

const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"]
let quests = [...QuestsStore.quests.values()].filter(x => x.userStatus?.enrolledAt && !x.userStatus?.completedAt && new Date(x.config.expiresAt).getTime() > Date.now() && supportedTasks.find(y => Object.keys((x.config.taskConfig ?? x.config.taskConfigV2).tasks).includes(y)))
let isApp = typeof DiscordNative !== "undefined"
if(quests.length === 0) {
	console.log("You don't have any uncompleted quests!")
} else {
	let doJob = function() {
		const quest = quests.pop()
		if(!quest) return

		const pid = Math.floor(Math.random() * 30000) + 1000
		
		const questName = quest.config.messages.questName
		const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2
		const taskName = supportedTasks.find(x => taskConfig.tasks[x] != null)
		const taskData = taskConfig.tasks[taskName]
		const applicationId = quest.config.application?.id ?? taskData.applications?.[0]?.id
		const secondsNeeded = taskData.target
		let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0

		if(taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
			const speed = 7
			const enrolledAt = new Date(quest.userStatus.enrolledAt).getTime()
			let completed = false
			let fn = async () => {			
				while(true) {
					const remaining = Math.min(speed, secondsNeeded - secondsDone)
					await new Promise(resolve => setTimeout(resolve, remaining * 1000))

					const timestamp = secondsDone + speed
					const res = await api.post({url: `/quests/${quest.id}/video-progress`, body: {timestamp: Math.min(secondsNeeded, timestamp + Math.random())}})
					completed = res.body.completed_at != null
					secondsDone = Math.min(secondsNeeded, timestamp)

					if(timestamp >= secondsNeeded) {
						break
					}
				}
				if(!completed) {
					await api.post({url: `/quests/${quest.id}/video-progress`, body: {timestamp: secondsNeeded}})
				}
				console.log("Quest completed!")
				doJob()
			}
			fn()
			console.log(`Spoofing video for ${questName}.`)
		} else if(taskName === "PLAY_ON_DESKTOP") {
			if(!isApp) {
				console.log("This no longer works in browser for non-video quests. Use the discord desktop app to complete the", questName, "quest!")
			} else {
				api.get({url: `/applications/public?application_ids=${applicationId}`}).then(res => {
					const appData = res.body[0]
					const exeName = appData.executables?.find(x => x.os === "win32")?.name?.replace(">","") ?? appData.name.replace(/[\/\\:*?"<>|]/g, "")
					
					const fakeGame = {
						cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
						exeName,
						exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
						hidden: false,
						isLauncher: false,
						id: applicationId,
						name: appData.name,
						pid: pid,
						pidPath: [pid],
						processName: appData.name,
						start: Date.now(),
					}
					const realGames = RunningGameStore.getRunningGames()
					const fakeGames = [fakeGame]
					const realGetRunningGames = RunningGameStore.getRunningGames
					const realGetGameForPID = RunningGameStore.getGameForPID
					RunningGameStore.getRunningGames = () => fakeGames
					RunningGameStore.getGameForPID = (pid) => fakeGames.find(x => x.pid === pid)
					FluxDispatcher.dispatch({type: "RUNNING_GAMES_CHANGE", removed: realGames, added: [fakeGame], games: fakeGames})
					
					let fn = data => {
						let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value)
						console.log(`Quest progress: ${progress}/${secondsNeeded}`)
						
						if(progress >= secondsNeeded) {
							console.log("Quest completed!")
							
							RunningGameStore.getRunningGames = realGetRunningGames
							RunningGameStore.getGameForPID = realGetGameForPID
							FluxDispatcher.dispatch({type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: []})
							FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
							
							doJob()
						}
					}
					FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
					
					console.log(`Spoofed your game to ${appData.name}. Wait for ${Math.ceil((secondsNeeded - secondsDone) / 60)} more minutes.`)
				})
			}
		} else if(taskName === "STREAM_ON_DESKTOP") {
			if(!isApp) {
				console.log("This no longer works in browser for non-video quests. Use the discord desktop app to complete the", questName, "quest!")
			} else {
				let realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata
				ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
					id: applicationId,
					pid,
					sourceName: null
				})
				
				let fn = data => {
					let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.STREAM_ON_DESKTOP.value)
					console.log(`Quest progress: ${progress}/${secondsNeeded}`)
					
					if(progress >= secondsNeeded) {
						console.log("Quest completed!")
						
						ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc
						FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
						
						doJob()
					}
				}
				FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
				
				console.log(`Spoofed your stream to the target game. Stream any window in vc for ${Math.ceil((secondsNeeded - secondsDone) / 60)} more minutes.`)
				console.log("Remember that you need at least 1 other person to be in the vc!")
			}
		} else if(taskName === "PLAY_ACTIVITY") {
			const channelId = ChannelStore.getSortedPrivateChannels()[0]?.id ?? Object.values(GuildChannelStore.getAllGuilds()).find(x => x != null && x.VOCAL.length > 0).VOCAL[0].channel.id
			const streamKey = `call:${channelId}:1`
			
			let fn = async () => {
				console.log("Completing quest", questName, "-", quest.config.messages.questName)
				
				while(true) {
					const res = await api.post({url: `/quests/${quest.id}/heartbeat`, body: {stream_key: streamKey, terminal: false}})
					const progress = res.body.progress.PLAY_ACTIVITY.value
					console.log(`Quest progress: ${progress}/${secondsNeeded}`)
					
					await new Promise(resolve => setTimeout(resolve, 20 * 1000))
					
					if(progress >= secondsNeeded) {
						await api.post({url: `/quests/${quest.id}/heartbeat`, body: {stream_key: streamKey, terminal: true}})
						break
					}
				}
				
				console.log("Quest completed!")
				doJob()
			}
			fn()
		}
	}
	doJob()
}
```

---

## settings.json (backup)
```json
{
  "IS_MAXIMIZED": true,
  "IS_MINIMIZED": false,
  "WINDOW_BOUNDS": {
    "x": 0,
    "y": 0,
    "width": 1024,
    "height": 538
  },
  "BACKGROUND_COLOR": "#121214",
  "audioSubsystem": "experimental",
  "offloadAdmControls": true,
  "enableHardwareAcceleration": true,
  "OPTIN_OPTIONAL_UPDATES": true,
  "chromiumSwitches": {},
  "OPEN_ON_STARTUP": false,
  "openH264Enabled": true,
  "asyncVideoInputDeviceInit": true,
  "USE_RUST_BSPATCH": true
}
```
