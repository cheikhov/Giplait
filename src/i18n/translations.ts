import type { Language, MenuId } from '../types/stock';

export const MENU_ORDER: MenuId[] = [
  'dashboard',
  'products',
  'stock',
  'reception',
  'livraison',
  'inventory',
  'distributors',
  'movements',
  'reports',
  'archives',
  'settings',
];

export const TRANSLATIONS: Record<
  Language,
  {
    appName: string;
    subtitle: string;
    menu: Record<MenuId, string>;
    actions: {
      scanDoc: string;
      addProduct: string;
      save: string;
      cancel: string;
      confirm: string;
      delete: string;
      edit: string;
      exportPdf: string;
      exportExcel: string;
      validateInventory: string;
      startInventory: string;
      openCamera: string;
      uploadFile: string;
      logout: string;
      searchPlaceholder: string;
    };
    dashboard: {
      currentStock: string;
      totalIn: string;
      totalOut: string;
      productsInStock: string;
      docsProcessed: string;
      discrepancies: string;
      dailyInventoryStatus: string;
      inventoryDone: string;
      inventoryPending: string;
      latestMovements: string;
      alertsTitle: string;
      activityHistory: string;
      categoryBreakdown: string;
      units: string;
    };
    status: {
      normal: string;
      low: string;
      out: string;
      confirmed: string;
      validated: string;
    };
    roles: {
      admin: string;
      chef_de_quai: string;
      operateur: string;
    };
  }
> = {
  fr: {
    appName: 'GESTION DE STOCK – CHEF DE QUAI',
    subtitle: 'Chaîne du Froid & Distribution Laitière',
    menu: {
      dashboard: 'TABLEAU DE BORD',
      products: 'PRODUITS',
      stock: 'GESTION DE STOCK',
      reception: 'BON DE RÉCEPTION',
      livraison: 'BON DE LIVRAISON',
      inventory: 'INVENTAIRE GÉNÉRAL',
      distributors: 'DISTRIBUTEURS',
      movements: 'MOUVEMENTS DE STOCK',
      reports: 'RAPPORTS',
      archives: 'ARCHIVES',
      settings: 'PARAMÈTRES',
    },
    actions: {
      scanDoc: 'Scanner un Bon',
      addProduct: 'Nouveau Produit',
      save: 'Enregistrer',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      delete: 'Supprimer',
      edit: 'Modifier',
      exportPdf: 'Exporter PDF',
      exportExcel: 'Exporter Excel',
      validateInventory: 'VALIDER INVENTAIRE',
      startInventory: 'Démarrer Inventaire Général',
      openCamera: 'Ouvrir Caméra',
      uploadFile: 'Importer Image',
      logout: 'Déconnexion',
      searchPlaceholder: 'Rechercher produit, référence, code-barres, bon...',
    },
    dashboard: {
      currentStock: 'Stock Total Actuel',
      totalIn: 'Total Entrées',
      totalOut: 'Total Sorties',
      productsInStock: 'Produits en Stock',
      docsProcessed: 'Bons Traités',
      discrepancies: "Écarts d'Inventaire",
      dailyInventoryStatus: 'Inventaire du Jour',
      inventoryDone: 'Validé aujourd’hui',
      inventoryPending: 'En attente de validation',
      latestMovements: 'Derniers Mouvements de Stock',
      alertsTitle: 'Alertes & Ruptures de Stock',
      activityHistory: "Historique d'Activité",
      categoryBreakdown: 'Répartition du Stock par Catégorie',
      units: 'unités',
    },
    status: {
      normal: 'Stock Normal',
      low: 'Stock Bas',
      out: 'Rupture',
      confirmed: 'Confirmé',
      validated: 'Validé',
    },
    roles: {
      admin: 'Administrateur',
      chef_de_quai: 'Chef de Quai',
      operateur: 'Opérateur de Stock',
    },
  },
  ar: {
    appName: 'إدارة المخزون – رئيس الرصيف',
    subtitle: 'سلسلة التبريد وتوزيع الحليب ومشتقاته',
    menu: {
      dashboard: 'لوحة القيادة',
      products: 'المنتجات',
      stock: 'إدارة المخزون',
      reception: 'وصل الاستلام',
      livraison: 'وصل التسليم',
      inventory: 'الجرد العام',
      distributors: 'الموزعون',
      movements: 'حركات المخزون',
      reports: 'التقارير',
      archives: 'الأرشيف',
      settings: 'الإعدادات',
    },
    actions: {
      scanDoc: 'مسح الوثيقة',
      addProduct: 'منتج جديد',
      save: 'حفظ',
      cancel: 'إلغاء',
      confirm: 'تأكيد',
      delete: 'حذف',
      edit: 'تعديل',
      exportPdf: 'تصدير PDF',
      exportExcel: 'تصدير Excel',
      validateInventory: 'اعتماد الجرد العام',
      startInventory: 'بدء جرد عام جديد',
      openCamera: 'تشغيل الكاميرا',
      uploadFile: 'رفع صورة',
      logout: 'تسجيل الخروج',
      searchPlaceholder: 'بحث عن منتج، مرجع، باركود، وصل...',
    },
    dashboard: {
      currentStock: 'إجمالي المخزون الحالي',
      totalIn: 'إجمالي المدخلات',
      totalOut: 'إجمالي المخرجات',
      productsInStock: 'المنتجات المتوفرة',
      docsProcessed: 'الوثائق المعالجة',
      discrepancies: 'فروقات الجرد',
      dailyInventoryStatus: 'حالة الجرد اليومي',
      inventoryDone: 'معتمد اليوم',
      inventoryPending: 'في انتظار الاعتماد',
      latestMovements: 'آخر حركات المخزون',
      alertsTitle: 'تنبيهات المخزون والنفاذ',
      activityHistory: 'سجل النشاط',
      categoryBreakdown: 'توزيع المخزون حسب الفئة',
      units: 'وحدة',
    },
    status: {
      normal: 'مخزون عادي',
      low: 'مخزون منخفض',
      out: 'نفاد المخزون',
      confirmed: 'مؤكد',
      validated: 'معتمد',
    },
    roles: {
      admin: 'مدير النظام',
      chef_de_quai: 'رئيس الرصيف',
      operateur: 'عون مخزون',
    },
  },
};
