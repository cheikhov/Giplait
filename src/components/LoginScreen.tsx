import React from 'react';
import { Globe, PackageCheck, ShieldCheck, Truck, Warehouse } from 'lucide-react';
import { IMG_PLANT_HERO } from '../data/catalog';
import { TRANSLATIONS } from '../i18n/translations';
import type { Language } from '../types/stock';

interface LoginScreenProps {
  language: Language;
  onToggleLanguage: () => void;
  onGoogleLogin: () => Promise<void>;
  authError: string | null;
  loading: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  language,
  onToggleLanguage,
  onGoogleLogin,
  authError,
  loading,
}) => {
  const t = TRANSLATIONS[language];
  const isAr = language === 'ar';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Corporate Giplait-inspired Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#004B93] flex items-center justify-center text-white font-bold text-sm">
            GQ
          </div>
          <span className="font-bold text-[#004B93] text-base tracking-tight whitespace-nowrap">
            {t.appName}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleLanguage}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
        >
          <Globe className="w-4 h-4 text-[#004B93]" />
          {isAr ? 'Français' : 'العربية (RTL)'}
        </button>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Visual Showcase inspired by Giplait.dz */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="relative h-64 sm:h-80 w-full bg-slate-100">
            <img
              src={IMG_PLANT_HERO}
              alt="Quai de chargement et laiterie industrielle"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#002852]/95 via-[#00356B]/65 to-black/15 flex flex-col justify-end p-6 text-white">
              <p className="text-xs font-semibold tracking-wide text-emerald-300 mb-1">
                {isAr ? 'سلسلة التبريد واللوجستيك' : 'CHAÎNE DU FROID & LOGISTIQUE LAITIÈRE'}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                {isAr
                  ? 'المنصة الرقمية لإدارة مخزون الرصيف'
                  : 'Pilotage Industriel des Stocks & Quai de Distribution'}
              </h1>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 flex-1 bg-white">
            <div className="space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-[#EEF5FC] text-[#004B93] flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900">
                {isAr ? 'قراءة الوثائق بالذكاء الاصطناعي' : 'OCR Bons Réception & Livraison'}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isAr
                  ? 'مسح ضوئي فوري للوصولات والتحقق قبل تعديل المخزون.'
                  : 'Capture caméra directe, extraction automatique et validation avant mise à jour.'}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
                <Warehouse className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900">
                {isAr ? 'جرد عام موحد لغرف التبريد' : 'Inventaire Général Consolidé'}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isAr
                  ? 'تجميع كميات كافة غرف التبريد ومقارنتها بالمخزون النظري.'
                  : 'Cumul automatique de toutes les chambres froides et calcul instantané des écarts.'}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-[#EEF5FC] text-[#004B93] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900">
                {isAr ? 'تتبع دقيق وتقارير PDF/Excel' : 'Traçabilité & Audit Complet'}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isAr
                  ? 'سجل زمني للحركات ومنع تكرار الوصولات والمخزون السالب.'
                  : 'Protection contre les doublons, stock négatif bloqué et export PDF/Excel.'}
              </p>
            </div>
          </div>
        </section>

        {/* Right Cloud Firestore Authentication Panel */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {isAr ? 'تسجيل الدخول إلى المنصة السحابية' : 'Connexion Cloud Firestore'}
              </h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                {isAr
                  ? 'سجّل الدخول بحساب Google الخاص بك لبدء مساحة عمل فارغة تحتوي على كتالوج المنتجات فقط ومزامنة فورية عبر السحابة.'
                  : 'Connectez-vous avec votre compte Google pour accéder à votre espace Cloud Firestore sécurisé et synchronisé en temps réel.'}
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {authError}
              </div>
            )}

            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-[#004B93] hover:bg-[#00356B] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60 shadow-xs"
            >
              <ShieldCheck className="w-4 h-4" />
              {loading
                ? isAr
                  ? 'جاري الاتصال...'
                  : 'Connexion en cours...'
                : isAr
                ? 'تسجيل الدخول / حساب جديد عبر Google'
                : 'Connexion Google (Cloud Firestore)'}
            </button>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-start gap-3">
                <PackageCheck className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed">
                  <strong className="text-slate-900 block mb-0.5">
                    {isAr ? 'حساب جديد جاهز بكتالوج المنتجات فقط' : 'Démarrage propre pour chaque nouveau compte'}
                  </strong>
                  {isAr
                    ? 'يتم تهيئة الحساب الجديد بجميع المنتجات الـ 69 مع مخزون 0، وبدون حركات أو وصولات أو موزعين مسبقين.'
                    : 'Tout nouveau compte démarre avec les 69 produits officiels préchargés à stock 0 (mouvements, bons, distributeurs et inventaires vides).'}
                </div>
              </div>
              <div className="flex items-start gap-3 pt-2 border-t border-slate-200">
                <ShieldCheck className="w-4 h-4 text-[#004B93] shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed">
                  <strong className="text-slate-900 block mb-0.5">
                    {isAr ? 'عزل تام وحفظ سحابي آمن' : 'Isolation & persistance Cloud Firestore'}
                  </strong>
                  {isAr
                    ? 'كل حساب يملك مساحة عمل خاصة ومحفوظة في Cloud Firestore عبر جميع أجهزتك.'
                    : 'Chaque compte dispose de son espace isolé et persisté dans Cloud Firestore sur mobile, tablette et ordinateur.'}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-6 pt-4 border-t border-slate-100">
            {isAr
              ? 'الكتالوج الرسمي: 69 منتجاً للحليب ومشتقاته مدمج ومفهرس · Cloud Firestore.'
              : 'Catalogue officiel de 69 produits laitiers préchargé · Stock initial 0 · Cloud Firestore.'}
          </p>
        </section>
      </main>
    </div>
  );
};
