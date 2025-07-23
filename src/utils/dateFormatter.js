const formatDate = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const locale = process.env.SITE_LANGUAGE || 'fr'; // Use SITE_LANGUAGE from .env, default to 'fr'
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Intl.DateTimeFormat(locale, options).format(date);
};

module.exports = {
  formatDate,
};