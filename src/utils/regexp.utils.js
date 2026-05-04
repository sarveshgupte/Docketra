const escapeRegExp = (string) => {
  return String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};

module.exports = {
  escapeRegExp,
};
