

## Plan: Gör loggan klickbar på alla sidor

Loggan visas på tre ställen — `/login`, `/`, och `/admin/dashboard`. Den ska bli klickbar och navigera till startsidan.

### Ändringar

1. **`src/pages/MemberLogin.tsx`** — Wrappa logo-`<img>` i en `<Link to="/">` eller `useNavigate`-klick.

2. **`src/pages/Index.tsx`** — Wrappa logo-`<img>` i en `<Link to="/">` (eller gör den till en no-op eftersom man redan är på `/`).

3. **`src/pages/AdminDashboard.tsx`** — Wrappa loggan i sidebar och mobilheader med `<Link to="/admin/dashboard">` (eller `/`) beroende på önskad destination. Sidebar-loggan navigerar till admin dashboard, vilket redan är aktuell sida — men klicken kan användas för att återställa till "Översikt"-tabben.

### Beteende
- På `/login` och `/`: klick → navigera till `/`
- På admin dashboard: klick → sätt aktiv tab till "översikt" (redan på sidan)
- Alla loggor får `cursor-pointer` styling

