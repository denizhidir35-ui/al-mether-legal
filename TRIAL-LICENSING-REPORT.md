# AL METHER Legal — Demo / Lisans teslim notu

Kod mevcut `app_users` ve NextAuth sistemini kullanır. Ayrı kullanıcı sistemi kurulmadı.
2026-08-31 production enablement: `202608310900` migration'ı production Supabase üzerinde tek transaction içinde uygulandı ve migration geçmişine kaydedildi. Tek doğrulanmış mevcut yönetici profiline OWNER bayrağı verildi. Mevcut dört kullanıcının eski alanları ve 27 veri tablosunun önce/sonra özetleri eşleşti. Aşağıdaki yerel teslim notlarının production kurulum adımları bu işlemle tamamlandı.

Production veritabanına bağlı release adayı, yalnız işaretli fixture Auth/profile hesabıyla gerçek login/logout ve lisans yaşam döngüsü testlerini geçti. Fixture'a OWNER verilmedi, e-posta gönderilmedi, müşteri verisi değiştirilmedi; test sonunda fixture askıya alındı. Canlı domain üzerindeki deploy doğrulaması yayın adımında ayrıca yapılır.

## Davranış

- Yeni hesap: `TRIAL_PENDING`. Başlangıç/bitiş tarihleri OWNER onayından önce boştur.
- OWNER onayı: varsayılan 5, seçilebilir 2/5/7 gün; bir gün tam 24 saattir.
- İkinci kez onaylama demo saatini sıfırlamaz; reddedilir. Uzatma ayrı işlemdir.
- Aktif demo uzatılırken mevcut bitişe, süresi dolmuş demo uzatılırken database saatine süre eklenir. İlk başlangıç korunur.
- PostgreSQL `clock_timestamp()` erişim sırasında bitmiş demoyu `TRIAL_EXPIRED` yapar. Cron gerekmez. Erişim anından önce de RLS süreyi kontrol eder ve engeller.
- `ACTIVE` trial tarihinden bağımsızdır. `licensed_until = null` süresiz lisans demektir. Geçmiş bir son tarih, lisans kaydını silmeden `SUSPENDED` erişim davranışı üretir.
- Askıya alma giriş hesabını silmez; uygulama erişimini engeller.
- Mevcut aktif hesaplar migration sırasında süresiz `ACTIVE` olarak korunur; mevcut bekleyen hesaplar `TRIAL_PENDING`, diğer durumlar `SUSPENDED` olur.
- `/settings/licenses` yalnızca OWNER içindir. Mevcut ayarlardaki hesap alanında demo bilgisi ve OWNER yönetim bağlantısı bulunur.
- Mobil ve desktop tasarım yeniden yapılmadı; mevcut stil değişiklikleri korunarak yalnızca lisansla ilgili bilgi/kontroller eklendi.

## Güvenlik ve veri kapsamı

- `proxy.ts` mevcut ve gelecekteki korumalı sayfa/API isteklerini kapsar; RSC/prefetch dahil. Next 16'nın Proxy dosya kuralı nedeniyle `middleware.ts` kaldırıldı.
- JWT yalnızca kimliği kanıtlar. JWT'deki eski hesap durumu, browser saati veya localStorage lisans yetkisi vermez.
- Veri erişim katmanı `getOrCreateAppUser()` ayrıca database erişim kararını doğrular.
- Database hatası erişimi açmaz. Login/recovery/logout, hesap durumu ve erişim açıklama ekranları engellenmez.
- Mutation RPC yalnızca `service_role` tarafından çağrılır; sunucu aktör ID'sini oturumdan alır. Database OWNER alanını tekrar kontrol eder ve satır kilidiyle işlemi yapar.
- OWNER, mevcut profilin `is_license_owner` alanıdır. `role = admin` tek başına OWNER değildir. Bu alan browser veya kullanıcı metadata'sından verilemez.
- Eski yönetim `PATCH /api/admin/users` işlemi 409 döner; lisans akışına yönlendirir. Demo/lisans geçmişi olan hesaplar eski silme kontrolünden de silinemez.
- Mevcut `user_id` kapsamı ve RLS politikaları korunur. `current_app_user_id()` lisans koşuluyla daraltıldı; başka kullanıcıya ait verilere izin vermez.
- Dava, mail, belge, history veya hesap verisi demo bitiminde silinmez. Aktivasyondan sonra aynı ID/veriler devam eder.
- Bilinen eski localStorage anahtarları oturum sınırında kullanıcı ID'si ile ayrılır. Auth token ve tema anahtarları değiştirilmez. Sahibi bilinmeyen eski ortak kayıtlar silinmez ve yeni giriş yapan hesaba otomatik atanmaz/gösterilmez; gerekirse sahibi doğrulanarak ayrıca taşınmalıdır. Bu katman bir lisans güvenlik sınırı değildir.
- UETS/CELSE, mail, case parser ve gizli core uygulama dosyaları değiştirilmedi.

## Testler

`npm run test:trial`: 16 test; bellekte PGlite PostgreSQL, gerçek migration SQL'i, gerçek RLS, şifrelenmiş NextAuth test JWT'leri ve uygulamanın Proxy/erişim/OWNER route fonksiyonları kullanılır. Supabase ağ bağlantısı ve gerçek login sağlayıcısı fixture adaptörleriyle değiştirilir. `.env` yüklenmez, production'a bağlanılmaz.

Kapsam: pending oluşturma; 2/5/7 gün ve varsayılan 5 gün; OWNER ve USER ayrımı; tekrar onaylama/sıfırlama reddi; ayrı browser saat alanı; eski JWT; logout/login sonrasında tarihin korunması; bitiş; route/API/RSC matcher; uzatma; lisans; suspension; RLS ve local hesap ayrımı; veri korunması; sahte oturum; cross-origin mutation; eski onay endpoint'inin kapanması.

Ek regresyon: `node --test tests/admin-user-lifecycle.test.mjs tests/password-reset-email.test.mjs` — 8 test.

Kontroller: `npx tsc --noEmit`, `npm run build`, `git diff --check`.
Build mevcut Geist Google Font indirmesi için ağ erişimi gerektirir; ilk sandbox denemesi font ağı nedeniyle başarısız oldu, ağ erişimiyle başarılı oldu.

İlk yerel teslimde gerçek Supabase testi yapılmamıştı. Production enablement sırasında gerçek Supabase Auth + database üzerinde release adayıyla pending, 5 günlük onay, database saati, gerçek logout/login süre korunması, expired route/API reddi, lisans, suspension ve USER OWNER işlem reddi doğrulandı. Görsel tasarım değişikliği yapılmadı.

## MIGRATIONS

Yeni: `supabase/migrations/202608310900_trial_licensing.sql`.
Önkoşul: mevcut `supabase/migrations/20260820_user_data_rls_hardening.sql` uygulanmış olmalı. Yeni dosya mevcut migration dosyalarını değiştirmez. Migration tek transaction'dır; kullanıcı/business verisi silmez.

## ENV REQUIRED

Yeni env yok. Mevcut değerler kullanılır:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — yalnızca server
- `NEXTAUTH_SECRET` — yalnızca server
- `NEXTAUTH_URL` — gerçek uygulama origin'i

Testler bunların production değerlerine ihtiyaç duymaz. `@electric-sql/pglite` yalnızca devDependency olarak eklendi.

## MANUAL SUPABASE STEPS

1. Önce ayrı staging/test Supabase projesinde mevcut migration durumunu kontrol edin. Yeni migration'ı sırasıyla uygulayın. Production'da bu tur hiçbir adım çalıştırılmadı.
2. OWNER olacak mevcut hesabın `app_users.id` değerini ve gerçek giriş hesabını doğrulayın. Kullanıcı e-postasına göre otomatik OWNER ataması yapılmaz.
3. Yetkili SQL Editor'da, doğrulanmış mevcut aktif hesaba OWNER bayrağı verin. Aşağıdaki yer tutucuyu gerçek ID ile değiştirin ve yalnızca bir satırın etkilendiğini kontrol edin. Rol alanı değiştirilmez:

```sql
begin;
update public.app_users
set is_license_owner = true
where id::text = 'REPLACE_WITH_VERIFIED_EXISTING_OWNER_ID'
  and status = 'active'
  and subscription_status = 'ACTIVE'
returning id, email, role, is_license_owner, subscription_status;
-- Tam olarak doğrulanan bir hesap döndüyse commit; aksi durumda rollback.
commit;
```

4. OWNER ile `/settings/licenses` açın. Fixture/test hesapla pending -> 5 gün onay -> uzatma -> lisans -> suspension akışını doğrulayın. Normal USER ile aynı API'nin 403 verdiğini kontrol edin. Süreyi geçmişe alma testini yalnızca test hesabında/staging'de yapın.
5. `anon`/`authenticated` rollerinin lisans RPC'lerine ve `app_users` lisans/OWNER alanlarına yazamadığını, mevcut RLS migration'ının tüm ilgili tablolarda uygulandığını kontrol edin. Browser'a service-role key vermeyin.
6. Migration olmadan yeni uygulama sürümü uygulama erişimini güvenli şekilde kapalı tutar. OWNER ataması yapılmadan lisans yönetimi kullanılamaz. Production yayını ayrıca planlanmalıdır; bu tur deploy yapılmadı.

## FILES CHANGED — yalnızca bu görev

Değiştirilenler:

- `app/api/account/status/route.ts`
- `app/api/admin/users/route.ts`
- `app/settings/page.tsx` — önceden mevcut kullanıcı değişiklikleri korundu
- `components/AccountApprovalGate.tsx`
- `components/LegalSessionControl.tsx`
- `lib/alUser.ts`
- `lib/auth.ts` — yalnızca hesap oluşturma/giriş koşulu
- `package.json`, `package-lock.json`

Eklenenler:

- `proxy.ts` (`middleware.ts` yerine)
- `app/account/access/page.tsx`
- `app/settings/licenses/page.tsx`
- `app/api/admin/subscriptions/route.ts`
- `components/SubscriptionAccessScreen.tsx`
- `components/SubscriptionManagement.tsx`
- `components/SubscriptionSummary.tsx`
- `lib/accountStorage.ts`
- `lib/subscription.ts`
- `lib/subscriptionServer.ts`
- `supabase/migrations/202608310900_trial_licensing.sql`
- `tests/register-trial-loader.mjs`
- `tests/trial-loader.mjs`
- `tests/trial-fixture.mjs`
- `tests/trial-licensing.test.mjs`
- `TRIAL-LICENSING-REPORT.md`

Silinen: `middleware.ts` (Next 16 Proxy geçişi).

Başlangıçta bulunan globals.css, LegalDock, bridge dosyaları ve diğer untracked dosyalar bu görev kapsamında değiştirilmedi.
