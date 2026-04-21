# Streamlit Production Dashboard

Multipage Streamlit app with sidebar navigation, `st.cache_data`, Plotly charts, and typed env-driven settings via pydantic-settings.

## Quick start

```bash
pip install -r requirements.txt
cp .env.example .env   # fill in values
streamlit run app.py
```

Opens on [http://localhost:8501](http://localhost:8501).

## Project layout

```
app.py                  # entrypoint — sidebar, tabs, Settings class
pages/
  1_analysis.py         # analysis page (auto-registered by numeric prefix)
.streamlit/
  config.toml           # server port, theme
requirements.txt        # Python deps
.env.example            # documented env vars
```

## Configuration

All settings are read from `APP_*` environment variables. See `.env.example` for the full list.

| Variable            | Description         |
|---------------------|---------------------|
| `APP_SERVICE_NAME`  | Internal service label shown in sidebar |
| `APP_HEADLINE`      | Page title and sidebar heading |
| `APP_SUBHEADLINE`   | Sidebar caption beneath the heading |

## Adding pages

Drop a file into `pages/` using the `<number>_<Title>.py` naming convention:

```python
import streamlit as st
st.set_page_config(page_title="My Page", layout="wide")  # must be first call
st.title("My Page")
```

Streamlit auto-registers it in the sidebar in numeric order.

## Caching

- `@st.cache_data(ttl=...)` — DataFrames, API responses, computed values
- `@st.cache_resource` — database connections, ML models (singleton per process)

## Validation

```bash
node validate-streamlit.mjs
```
