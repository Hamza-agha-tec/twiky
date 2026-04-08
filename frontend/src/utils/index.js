export const createPageUrl = (pageName) => {
  if (pageName === 'Home') return '/';
  return `/${pageName.toLowerCase().replace(/\s+/g, '-')}`;
};
