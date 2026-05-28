// Simple Auto Banner Color Reset
(async () => {
    let _mods = webpackChunkdiscord_app.push([[Symbol()], {}, (e) => e.c]);
    webpackChunkdiscord_app.pop();
    
    let token = null;
    for (let mod of Object.values(_mods)) {
        try {
            if (mod.exports?.getToken) { token = mod.exports.getToken(); break; }
            for (let key in mod.exports) {
                if (mod.exports[key]?.getToken) { token = mod.exports[key].getToken(); break; }
            }
        } catch(e) {}
    }
    
    if (!token) return console.log('❌ Gagal: Token tidak ditemukan');
    
    try {
        const res = await fetch('https://discord.com/api/v9/users/@me/profile', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({ accent_color: null })
        });
        
        token = null;
        
        if (res.ok) {
            console.log('✅ Banner berhasil direset ke auto!');
            alert('Berhasil! 🔄 Refresh Discord');
            if (confirm('Refresh sekarang untuk melihat perubahan?')) location.reload();
        } else {
            console.log('❌ Gagal! Status:', res.status);
        }
    } catch(e) {
        console.log('❌ Error:', e.message);
    }
})();
