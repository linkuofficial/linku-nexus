const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [path.join(__dirname, 'index.html')],
    theme: {
        extend: {
            colors: {
                surface: '#051424',
                error: '#ffb4ab',
                'on-tertiary-fixed-variant': '#4f453a',
                'secondary-fixed-dim': '#c2c7d0',
                'surface-container-lowest': '#010f1f',
                'error-container': '#93000a',
                'surface-container-low': '#0d1c2d',
                primary: '#f0c050',
                'surface-tint': '#f0c050',
                'primary-fixed': '#e0e2ea',
                'on-error': '#690005',
                'on-secondary-fixed-variant': '#42474f',
                'on-error-container': '#ffdad6',
                'surface-container-high': '#1c2b3c',
                'on-secondary': '#2c3138',
                'on-surface': '#d4e4fa',
                'tertiary-fixed-dim': '#d2c4b5',
                'on-tertiary-container': '#83786b',
                secondary: '#c2c7d0',
                'surface-container': '#122131',
                'secondary-container': '#42474f',
                'on-secondary-fixed': '#171c23',
                'primary-fixed-dim': '#f0c050',
                outline: '#909095',
                'surface-container-highest': '#273647',
                'on-primary-fixed-variant': '#44474d',
                'inverse-primary': '#5b5e65',
                'outline-variant': '#45474b',
                'surface-bright': '#2c3a4c',
                'secondary-fixed': '#dee2ec',
                'on-tertiary': '#372f25',
                'on-primary': '#2d3036',
                'on-tertiary-fixed': '#221a11',
                'on-background': '#d4e4fa',
                tertiary: '#d2c4b5',
                'on-secondary-container': '#b1b5bf',
                'on-primary-fixed': '#181c21',
                'surface-variant': '#273647',
                'primary-container': '#070a0f',
                'on-surface-variant': '#c6c6cb',
                'inverse-on-surface': '#233143',
                'surface-dim': '#051424',
                'inverse-surface': '#d4e4fa',
                background: '#051424',
                'tertiary-fixed': '#efe0d0',
                'on-primary-container': '#777980',
                'tertiary-container': '#0f0903'
            },
            borderRadius: {
                DEFAULT: '0.125rem',
                lg: '0.25rem',
                xl: '0.5rem',
                full: '0.75rem'
            },
            spacing: {
                'margin-mobile': '16px',
                unit: '8px',
                gutter: '24px',
                'container-max': '1440px',
                'margin-desktop': '64px'
            },
            fontFamily: {
                // Display + headlines now ride Oxanium (was Sora); body stays Sora.
                'headline-md': ['Oxanium'],
                'label-caps': ['JetBrains Mono'],
                'body-base': ['Sora'],
                'display-lg-mobile': ['Oxanium'],
                'display-lg': ['Oxanium'],
                'body-sm': ['Sora'],
                'label-code': ['JetBrains Mono']
            },
            fontSize: {
                // Sizes resolve to the fluid clamp() tokens in nodus-theme.css so the
                // existing index.html utility classes scale 375px→1440px with no markup change.
                'headline-md': ['var(--text-lg)', { lineHeight: '1.3', fontWeight: '600' }],
                'label-caps': ['var(--text-xs)', { lineHeight: '1', letterSpacing: '0.1em', fontWeight: '500' }],
                'body-base': ['var(--text-base)', { lineHeight: '1.6', fontWeight: '400' }],
                'display-lg-mobile': ['var(--text-2xl)', { lineHeight: '1.2', fontWeight: '700' }],
                'display-lg': ['var(--text-4xl)', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
                'body-sm': ['var(--text-sm)', { lineHeight: '1.5', fontWeight: '400' }],
                'label-code': ['var(--text-sm)', { lineHeight: '1.4', fontWeight: '400' }]
            }
        }
    }
};
