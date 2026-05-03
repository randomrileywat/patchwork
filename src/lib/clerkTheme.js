// Clerk dark theme appearance config — matches Patchwork visual tokens.
export const clerkDarkAppearance = {
  variables: {
    colorBackground: '#161920',
    colorInputBackground: '#1e222d',
    colorText: '#e8eaf0',
    colorTextSecondary: '#8b92a8',
    colorPrimary: '#00d4a8',
    colorDanger: '#ff6b6b',
    borderRadius: '0.75rem',
    fontFamily: 'IBM Plex Sans, sans-serif',
  },
  elements: {
    card: 'border border-[#2a2f3d] shadow-none',
    formButton: 'font-mono tracking-wide',
    // Social (OAuth) buttons: white background so provider logos/text are legible
    socialButtonsBlockButton: 'bg-white hover:bg-gray-100 border border-gray-200 text-gray-900',
    socialButtonsBlockButtonText: 'text-gray-900 font-medium',
    // Hide Clerk branding footer

  },
};
