const configuredRepository = import.meta.env.CONTENT_REPOSITORY ?? '';
export const site = {
  name: 'Zanuain',
  description: '记录日常学习中的理解、实践与备忘。只把真正用得上的东西留下来。',
  repository: /^[\w.-]+\/[\w.-]+$/.test(configuredRepository) ? configuredRepository : '',
};
export const repositoryUrl = site.repository ? `https://github.com/${site.repository}` : '/about/#source';
