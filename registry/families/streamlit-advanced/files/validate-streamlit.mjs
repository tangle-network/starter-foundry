import { existsSync, readFileSync } from 'node:fs'

const must = (cond, msg) => {
  if (!cond) {
    console.error(`validate-streamlit: ${msg}`)
    process.exit(1)
  }
}

must(existsSync('app.py'), 'missing app.py entrypoint')
must(existsSync('pages/1_analysis.py'), 'missing pages/1_analysis.py (Streamlit multipage convention: pages/<number>_<name>.py)')
must(existsSync('requirements.txt'), 'missing requirements.txt')
must(existsSync('.streamlit/config.toml'), 'missing .streamlit/config.toml')

const reqs = readFileSync('requirements.txt', 'utf8')
must(/streamlit/.test(reqs), 'requirements.txt must pin streamlit')
must(/plotly/.test(reqs), 'requirements.txt must pin plotly')
must(/pydantic/.test(reqs), 'requirements.txt must pin pydantic')

const app = readFileSync('app.py', 'utf8')
must(/st\.set_page_config/.test(app), 'app.py must call st.set_page_config (required before any other Streamlit call)')
must(/@st\.cache_data|@st\.cache_resource/.test(app), 'app.py should use st.cache_data or st.cache_resource to demonstrate caching')

const cfg = readFileSync('.streamlit/config.toml', 'utf8')
must(/\[server\]/.test(cfg), '.streamlit/config.toml must have a [server] section')

console.log('streamlit-advanced starter ok')
