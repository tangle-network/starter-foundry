export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' })
  eleventyConfig.setServerOptions({ port: Number(process.env.PORT) || 8097 })

  return {
    dir: {
      input: 'src',
      includes: '_includes',
      layouts: '_includes',
      output: '_site',
    },
    templateFormats: ['md', 'njk', 'html'],
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  }
}
