from datetime import date, timedelta

import pandas as pd
import plotly.express as px
import streamlit as st
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="APP_")

    service_name: str = Field(default="{{serviceName}}")
    headline: str = Field(default="{{headline}}")
    subheadline: str = Field(default="{{subheadline}}")


settings = Settings()

st.set_page_config(
    page_title=settings.headline,
    page_icon=":bar_chart:",
    layout="wide",
    initial_sidebar_state="expanded",
)


@st.cache_data(ttl=600)
def load_timeseries(days: int) -> pd.DataFrame:
    today = date.today()
    index = [today - timedelta(days=days - i - 1) for i in range(days)]
    values = [100 + i * 1.3 + (i % 7) * 3 for i in range(days)]
    return pd.DataFrame({"date": index, "metric": values})


with st.sidebar:
    st.title(settings.headline)
    st.caption(settings.subheadline)
    window = st.slider("Window (days)", min_value=14, max_value=180, value=60, step=7)
    st.divider()
    st.write("Service: ", settings.service_name)


tab_overview, tab_detail, tab_about = st.tabs(["Overview", "Detail", "About"])

with tab_overview:
    st.header("Overview")
    df = load_timeseries(window)
    col_a, col_b, col_c = st.columns(3)
    col_a.metric("Latest", f"{df['metric'].iloc[-1]:.1f}")
    col_a.caption("Most recent sample")
    col_b.metric("Mean", f"{df['metric'].mean():.1f}")
    col_b.caption(f"Over last {window} days")
    col_c.metric("Delta", f"{df['metric'].iloc[-1] - df['metric'].iloc[0]:+.1f}")
    col_c.caption("First-to-last drift")

    fig = px.line(df, x="date", y="metric", title="Metric over time")
    fig.update_layout(margin=dict(l=0, r=0, t=40, b=0))
    st.plotly_chart(fig, use_container_width=True)

with tab_detail:
    st.header("Detail")
    st.dataframe(load_timeseries(window), use_container_width=True)

with tab_about:
    st.header("About")
    st.markdown(
        """
        This is the multipage entrypoint. Additional pages live under `pages/`
        and Streamlit auto-registers them in the sidebar in numeric order.

        - Caching: `@st.cache_data` for DataFrames, `@st.cache_resource` for connections.
        - Settings: `Settings` reads `APP_*` env vars via pydantic-settings.
        - Theme: `.streamlit/config.toml`.
        """
    )
