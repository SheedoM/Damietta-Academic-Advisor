/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                university: {
                    DEFAULT: '#0160C9',
                    50: '#e5f0fa',
                    100: '#cce1f4',
                    200: '#99c3e9',
                    300: '#66a5df',
                    400: '#3387d4',
                    500: '#0160C9',
                    600: '#014da1',
                    700: '#013a79',
                    800: '#012650',
                    900: '#001328',
                }
            }
        },
    },
    plugins: [],
}
