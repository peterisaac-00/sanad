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
    answer_ar: 'نحن شفافون تماماً: الاشتراك الثابت للمنصة يغطي تشغيل المتجر واستضافته ولوحة التحكم ومناطق الشحن اليدوية. التكاليف الخارجية التي لا تعود للمنصة هي: (1) لا توجد رسوم دفع إلكتروني لأن الخدمة غير متاحة حالياً، (2) تكلفة بوالص الشحن التي تسددها لشركات النقل مباشرة — الربط والتتبع داخل سند غير متاحين، (3) النطاق الفرعي مجاني؛ ربط نطاق مستقل غير متاح بعد.',
    answer_en: 'We maintain complete transparency: The fixed subscription covers store operations, hosting, the dashboard, and manual shipping zones. External costs include: (1) no payment-gateway fees because online payments are not available yet, (2) courier freight paid directly to logistics providers — Sanad has no carrier integration or tracking, (3) the subdomain is free; connecting a custom domain is not available yet.'
  },
  {
    id: 'c3',
    category: 'commercial',
    category_name_ar: 'الأسعار والعمولة',
    category_name_en: 'Pricing & Commission',
    question_ar: 'هل أستطيع إلغاء اشتراكي في أي وقت؟',
    question_en: 'Can I cancel my subscription at any time?',
    answer_ar: 'نعم، لا يوجد أي إلزام طويل الأجل في الخطة الشهرية. يمكنك إلغاء تجديد الاشتراك بالتواصل مع الدعم قبل موعده، وتبقى بياناتك محفوظة. تصدير الطلبات والعملاء متاح بصيغة CSV؛ تصدير كامل البيانات بصيغ أخرى قيد التطوير.',
    answer_en: 'Yes, there is no long-term lock-in on the monthly plan. Contact support before renewal to cancel, and your data remains stored. Orders and customers can be exported as CSV; a complete export in other formats is planned.'
  },
  {
    id: 'o1',
    category: 'cod',
    category_name_ar: 'الدفع عند الاستلام والشحن',
    category_name_en: 'COD & Logistics',
    question_ar: 'كيف يساعدني نظام سند في تقليل مرتجعات الدفع عند الاستلام (COD)؟',
    question_en: 'How does Sanad Commerce help me reduce Cash on Delivery (COD) returns?',
    answer_ar: 'صممنا المنصة على أساس دورة حياة واقعية للتجارة في مصر والوطن العربي: (1) تتبع الحالات من التأكيد وحتى التحصيل الفعلي، (2) رسالة تأكيد جاهزة تُفتح في واتساب ويرسلها فريقك يدوياً للتحقق من العنوان قبل الشحن، (3) إمكانية إضافة رسم رمزي على COD، (4) تنبيه يدوي/داخلي قبل خروج الشحنة، (5) حظر العملاء المتكررين في رفض الشحنات.',
    answer_en: 'We architected the platform around local Arab commerce dynamics: (1) Full order lifecycle from verification to cash collection, (2) A prepared WhatsApp confirmation message that your team sends manually before dispatch, (3) Optional COD surcharge, (4) Manual/internal pre-dispatch reminders, (5) Flagging chronic non-serious buyers.'
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
    answer_ar: 'المنصة تدعم تسجيل الطلبات الإقليمية يدوياً: يمكنك إدخال اسم العميل وعنوانه بعملة المتجر، والدفع عند الاستلام أو التحويل البنكي الذي تسجله يدوياً. الدفع الإلكتروني بالبطاقات وApple Pay غير متاح في النسخة الحالية، والشحن الدولي يتم بالتنسيق مع شركة الشحن خارج سند.',
    answer_en: 'The platform supports manually recorded regional orders: enter the customer name and address in your store currency, with cash on delivery or a bank transfer you record manually. Card payments and Apple Pay are not available in the current release, and international shipping is coordinated with the courier outside Sanad.'
  },
  {
    id: 'g2',
    category: 'gulf',
    category_name_ar: 'التوسع والخليج وتعدد العملات',
    category_name_en: 'Gulf & Multi-Currency',
    question_ar: 'ما الفرق بين نظام سعر الصرف التلقائي واليدوي؟',
    question_en: 'What is the difference between automatic and manual exchange rate modes?',
    answer_ar: 'لا يوجد حالياً تحديث تلقائي لأسعار الصرف. يحدد المتجر عملة أساسية واحدة وتُعرض الأسعار بها؛ تعدد العملات والتحويل التلقائي بينها قيد التطوير ولم يُفعّل بعد.',
    answer_en: 'There is no automatic FX update today. Each store has one base currency and prices are shown in it; multi-currency conversion is planned and not enabled yet.'
  },
  {
    id: 'm1',
    category: 'marketing',
    category_name_ar: 'التسويق ومنصات ميتا وجوجل وواتساب',
    category_name_en: 'Marketing & Ad Channels',
    question_ar: 'هل يوجد تكامل مع Meta Commerce أو Google؟',
    question_en: 'Is there a Meta Commerce or Google integration?',
    answer_ar: 'لا توجد تغذية تلقائية أو تكامل Meta Pixel/CAPI داخل سند في النسخة الحالية، ولم نُطلق خلاصة منتجات حية. المتاح هو تصدير الطلبات والعملاء بملفات CSV لاستخدامها في أدواتك الخارجية إلى أن يكتمل التكامل.',
    answer_en: 'There is no automated Meta Pixel/CAPI integration or live product feed in the current release. You can export orders and customers as CSV for external tools until the integration ships.',
  },
  {
    id: 't1',
    category: 'tech',
    category_name_ar: 'التقنية والترحيل والأمان',
    category_name_en: 'Tech & Migration',
    question_ar: 'أنا أستخدم شوبيفاي / سلة / ووكومرس حالياً، كيف أنقل متجري إلى سند؟',
    question_en: 'I currently sell on Shopify / Salla / WooCommerce, how do I migrate to Sanad?',
    answer_ar: 'مركز الترحيل التلقائي غير متاح حالياً. يمكنك إضافة المنتجات والفئات يدوياً من لوحة التحكم، وتصدير الطلبات والعملاء بملفات CSV. استيراد كتالوج كامل من منصة سابقة قيد التطوير ولم يُفعّل بعد.',
    answer_en: 'Automatic migration is not available yet. Add products and categories manually from the dashboard, and export orders and customers as CSV. Bulk catalog import from a legacy platform is planned and not enabled.'
  }
];
