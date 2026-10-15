export interface FAQItem {
  id: string;
  category: 'commercial' | 'cod' | 'gulf' | 'marketing' | 'tech';
  category_name_ar: string;
  category_name_en: string;
  question_ar: string;
  question_en: string;
  answer_ar: string;
  answer_en: string;
}

export const FAQS_DATA: FAQItem[] = [
  {
    id: 'c1',
    category: 'commercial',
    category_name_ar: 'الأسعار والعمولة',
    category_name_en: 'Pricing & Commission',
    question_ar: 'هل حقاً لا توجد أي عمولة للمنصة على الطلبات أو المبيعات؟',
    question_en: 'Is there genuinely 0% platform commission on orders or sales?',
    answer_ar: 'نعم، بكل وضوح وتأكيد: منصة سند للتجارة لا تتقاضى أي نسبة مئوية ولا أي رسم ثابت على أي طلب يحققه متجرك (0% عمولة للمنصة). رسومك هي فقط اشتراكك الثابت: 100 جنيه شهرياً أو 1,000 جنيه سنوياً (بتوفير 200 جنيه سنويًا). أرباحك ومبيعاتك بالكامل تعود لك دون أي اقتطاع.',
    answer_en: 'Yes, with absolute clarity: Sanad Commerce charges zero percentage and zero flat platform fee on any order (0% platform commission). Your only fee is your fixed subscription: 100 EGP/month or 1,000 EGP/year (saving 200 EGP/year). 100% of your margins stay yours.'
  },
  {
    id: 'c2',
    category: 'commercial',
    category_name_ar: 'الأسعار والعمولة',
    category_name_en: 'Pricing & Commission',
    question_ar: 'ما هي التكاليف الخارجية التي قد أدفعها لجهات أخرى؟',
    question_en: 'What external third-party costs might I incur with outside providers?',
    answer_ar: 'نحن شفافون تماماً: الاشتراك الثابت للمنصة يغطي تشغيل واستضافة متجرك ولوحة التحكم. التكاليف الخارجية التي لا تعود للمنصة هي: (1) رسوم المعالجة البنكية لبوابات الدفع الإلكتروني إن قمت بربطها (مثل باي موب أو فوري بنسبة تقارب 2.5% تذهب للبنك)، (2) تكلفة بوالص الشحن التي تسددها لشركات النقل مباشرة، (3) رسوم شراء اسم النطاق الخاص (.com / .eg) إن أردت شراءه من مسجل نطاقات خارجي.',
    answer_en: 'We maintain complete transparency: Our fixed subscription covers store operations, hosting, and operations software. External costs paid to third parties include: (1) Merchant acquiring fees set by payment gateways if integrated, (2) Courier freight tariffs paid directly to logistics providers, (3) Domain registrar annual fees if registering a custom .com/.eg domain.'
  },
  {
    id: 'c3',
    category: 'commercial',
    category_name_ar: 'الأسعار والعمولة',
    category_name_en: 'Pricing & Commission',
    question_ar: 'هل أستطيع إلغاء اشتراكي في أي وقت؟',
    question_en: 'Can I cancel my subscription at any time?',
    answer_ar: 'نعم، لا يوجد أي إلزام طويل الأجل في الخطة الشهرية. يمكنك إلغاء اشتراكك بنقرة واحدة من لوحة التحكم، وبياناتك تظل محفوظة ومتاحة للتصدير بملفات Excel / CSV بالكامل دون أي قيود.',
    answer_en: 'Yes, there is no long-term lock-in on the monthly plan. You can cancel with one click from your admin console, and your merchant data remains exportable to CSV/Excel anytime.'
  },
  {
    id: 'o1',
    category: 'cod',
    category_name_ar: 'الدفع عند الاستلام والشحن',
    category_name_en: 'COD & Logistics',
    question_ar: 'كيف يساعدني نظام سند في تقليل مرتجعات الدفع عند الاستلام (COD)؟',
    question_en: 'How does Sanad Commerce help me reduce Cash on Delivery (COD) returns?',
    answer_ar: 'صممنا المنصة على أساس دورة حياة واقعية للتجارة في مصر والوطن العربي: (1) تتبع الحالات من التأكيد وحتى التحصيل الفعلي، (2) قوالب تأكيد سريعة عبر واتساب للتحقق من دقة العنوان قبل الشحن، (3) إمكانية إضافة رسم رمزي على COD، (4) إشعار صباحي تلقائي للعميل يوم خروج الشحنة مع المندوب، (5) حظر العملاء المتكررين في رفض الشحنات.',
    answer_en: 'We architected the platform around local Arab commerce dynamics: (1) Full order lifecycle from verification to cash collection, (2) WhatsApp verification templates prior to dispatch, (3) Optional COD surcharge, (4) Morning delivery day alerts with exact cash amount required, (5) Flagging chronic non-serious buyers.'
  },
  {
    id: 'o2',
    category: 'cod',
    category_name_ar: 'الدفع عند الاستلام والشحن',
    category_name_en: 'COD & Logistics',
    question_ar: 'هل يمكنني تحديد أسعار شحن مختلفة لكل محافظة في مصر؟',
    question_en: 'Can I configure different shipping tariffs for each Egyptian governorate?',
    answer_ar: 'نعم بالتأكيد. تتيح لك إعدادات الشحن تقسيم المحافظات بدقة (القاهرة والجيزة، الإسكندرية، محافظات الدلتا، القناة، الصعيد، والمحافظات الحدودية)، وتحديد تكلفة شحن خاصة بكل منطقة، بالإضافة لتحديد حد أدنى للطلب لتفعيل الشحن المجاني.',
    answer_en: 'Yes, absolutely. You can cluster governorates (Greater Cairo, Alexandria, Delta, Upper Egypt, Canal, Frontier), assign custom rates to each region, and set minimum order thresholds for free shipping promotions.'
  },
  {
    id: 'g1',
    category: 'gulf',
    category_name_ar: 'التوسع والخليج وتعدد العملات',
    category_name_en: 'Gulf & Multi-Currency',
    question_ar: 'كيف أبيع لعملاء السعودية والإمارات والخليج وأنا في مصر؟',
    question_en: 'How can I sell to customers in Saudi Arabia, UAE, and GCC while based in Egypt?',
    answer_ar: 'المنصة مصممة معمارياً للتجارة الإقليمية العابرة للحدود: يمكنك تفعيل عرض الأسعار بالريال السعودي (SAR) والدرهم الإماراتي (AED) والدينار الكويتي (KWD). يدفع العميل الخليجي إلكترونياً ببطاقته أو عبر Apple Pay، وتشحن له عبر شركات الشحن الجوي السريع الدولية مع طباعة بوالص الشحن والفواتير المصاحبة.',
    answer_en: 'The architecture is engineered for cross-border commerce: Enable localized prices in SAR, AED, KWD. Gulf shoppers pay digitally via cards or Apple Pay, and you ship via express air couriers with automated export packing slips.'
  },
  {
    id: 'g2',
    category: 'gulf',
    category_name_ar: 'التوسع والخليج وتعدد العملات',
    category_name_en: 'Gulf & Multi-Currency',
    question_ar: 'ما الفرق بين نظام سعر الصرف التلقائي واليدوي؟',
    question_en: 'What is the difference between automatic and manual exchange rate modes?',
    answer_ar: 'الوضع التلقائي يقوم بتحديث أسعار صرف العملات مقابل العملة الأساسية عبر واجهة بيانات أسعار الصرف الرسمية. الوضع اليدوي يمنحك السيطرة الكاملة على تثبيت سعر صرف محدد (مثلاً تحديد سعر تحويل الريال للجنيه يدوياً) أو إضافة هامش أمان بنسبة مئوية (مثل +2% أو +3%) للتحوط من أي فروقات بنكية.',
    answer_en: 'Automatic mode fetches official live exchange rates from FX data sources. Manual mode gives you total autonomy to lock in fixed custom exchange rates or add a safety buffer margin (+2% or +3%) against currency fluctuation.'
  },
  {
    id: 'm1',
    category: 'marketing',
    category_name_ar: 'التسويق ومنصات ميتا وجوجل وواتساب',
    category_name_en: 'Marketing & Ad Channels',
    question_ar: 'كيف يدعم المتجر إعلانات فيسبوك وإنستغرام (Meta Commerce)؟',
    question_en: 'How does the store integrate with Facebook & Instagram (Meta Commerce)?',
    answer_ar: 'نوفر تكاملاً شاملاً مع Meta: (1) ربط Meta Pixel و Conversions API (CAPI) لضمان تسجيل 100% من أحداث الشراء وتخطي مشاكل حظر المتصفحات، (2) تصدير كتالوج منتجات متجدد لحظياً (XML Product Feed) للربط المباشر مع مدير المعاملات التجارية بميتا ومطابقة إعلانات الكتالوج الديناميكية.',
    answer_en: 'We provide a complete Meta Commerce foundation: (1) Meta Pixel + Server-Side Conversions API (CAPI) to record 100% of purchase signals despite browser drops, (2) Real-time XML Product Feed syncing directly to Meta Commerce Manager for dynamic catalog ads.'
  },
  {
    id: 't1',
    category: 'tech',
    category_name_ar: 'التقنية والترحيل والأمان',
    category_name_en: 'Tech & Migration',
    question_ar: 'أنا أستخدم شوبيفاي / سلة / ووكومرس حالياً، كيف أنقل متجري إلى سند؟',
    question_en: 'I currently sell on Shopify / Salla / WooCommerce, how do I migrate to Sanad?',
    answer_ar: 'مركز الترحيل (Migration Center) يتيح لك استيراد ملفات CSV / Excel التي تحتوي على منتجاتك، أسعارها، تصنيفاتها، ومخزونها. كل ما عليك فعله هو تصدير منتجاتك من منصتك السابقة واستيرادها إلى سند بنقرات معدودة دون الحاجة لإعادة كتابة كل منتج يدوياً.',
    answer_en: 'Our Migration Center enables importing CSV/Excel files containing your products, prices, categories, and inventory. Simply export your data from your legacy platform and import it into Sanad in a few clicks without manual retyping.'
  }
];
