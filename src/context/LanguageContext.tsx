import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
    language: Language;
    toggleLanguage: () => void;
    t: (key: string) => string;
}

const translations: Record<string, Record<Language, string>> = {
    // Common
    'close': { en: 'Close', ar: 'إغلاق' },
    'save': { en: 'Save', ar: 'حفظ' },
    'cancel': { en: 'Cancel', ar: 'إلغاء' },
    'delete': { en: 'Delete', ar: 'حذف' },
    'edit': { en: 'Edit', ar: 'تعديل' },
    'search': { en: 'Search', ar: 'بحث' },
    'add': { en: 'Add', ar: 'إضافة' },
    'submit': { en: 'Submit', ar: 'إرسال' },
    'loading': { en: 'Loading...', ar: 'جاري التحميل...' },

    // Navigation
    'student_portal': { en: 'Student Portal', ar: 'بوابة الطالب' },
    'admin_dashboard': { en: 'Admin Dashboard', ar: 'لوحة تحكم المسؤول' },
    'faculty_name': { en: 'Faculty of Computer Science and Artificial Intelligence', ar: 'كلية علوم الحاسب والذكاء الاصطناعي' },

    // Student Portal
    'welcome_back': { en: 'Welcome back', ar: 'مرحبًا بعودتك' },
    'sign_in': { en: 'Sign In', ar: 'تسجيل الدخول' },
    'register': { en: 'Register', ar: 'تسجيل' },
    'national_id': { en: 'National ID', ar: 'الرقم القومي' },
    'university_id': { en: 'University ID', ar: 'الرقم الجامعي' },
    'full_name': { en: 'Full Name', ar: 'الاسم الكامل' },
    'major': { en: 'Major', ar: 'التخصص' },
    'transfer_student': { en: 'Transfer Student', ar: 'طالب محول' },
    'previous_university': { en: 'Previous University', ar: 'الجامعة السابقة' },
    'passed_courses': { en: 'Passed Courses', ar: 'المقررات المجتازة' },
    'search_add': { en: 'Search & Add', ar: 'بحث وإضافة' },
    'raw_json': { en: 'Raw JSON Input', ar: 'إدخال JSON' },
    'enroll': { en: 'ENROLL STUDENT RECORD', ar: 'تسجيل بيانات الطالب' },
    'already_registered': { en: 'Already registered?', ar: 'لديك حساب بالفعل؟' },
    'sign_in_instead': { en: 'Sign In Instead', ar: 'تسجيل الدخول بدلاً من ذلك' },

    // Dashboard
    'my_courses': { en: 'My Courses', ar: 'مقرراتي' },
    'academic_plan': { en: 'Academic Plan', ar: 'الخطة الأكاديمية' },
    'tickets': { en: 'Tickets', ar: 'التذاكر' },
    'gpa': { en: 'GPA', ar: 'المعدل التراكمي' },
    'passed_hours': { en: 'Passed Hours', ar: 'الساعات المجتازة' },
    'academic_level': { en: 'Academic Level', ar: 'المستوى الدراسي' },
    'degree_progress': { en: 'Degree Progress', ar: 'تقدم الدرجة العلمية' },

    // Admin
    'students': { en: 'Students', ar: 'الطلاب' },
    'all_courses': { en: 'All Courses', ar: 'جميع المقررات' },
    'bulk_generate': { en: 'Bulk Generate Plans', ar: 'إنشاء خطط مجمعة' },
    'overview': { en: 'Overview', ar: 'نظرة عامة' },
    'course_plans': { en: 'Course Plans', ar: 'خطط المقررات' },
    'ticket_history': { en: 'Ticket History', ar: 'سجل التذاكر' },
    'generate_plan': { en: 'Auto-Generate Plan', ar: 'إنشاء خطة تلقائية' },
    'approve': { en: 'Approve', ar: 'موافقة' },
    'block': { en: 'Block', ar: 'حظر' },
    'unblock': { en: 'Unblock', ar: 'إلغاء الحظر' },
    'resolve': { en: 'Resolve', ar: 'حل' },

    // Language Toggle
    'switch_to_arabic': { en: 'العربية', ar: 'English' },
};

const LanguageContext = createContext<LanguageContextType>({
    language: 'en',
    toggleLanguage: () => { },
    t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<Language>(() => {
        const saved = localStorage.getItem('app_language');
        return (saved === 'ar' ? 'ar' : 'en') as Language;
    });

    useEffect(() => {
        const html = document.documentElement;
        html.setAttribute('lang', language);
        html.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
        localStorage.setItem('app_language', language);
    }, [language]);

    const toggleLanguage = () => {
        setLanguage(prev => prev === 'en' ? 'ar' : 'en');
    };

    const t = (key: string): string => {
        return translations[key]?.[language] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);
