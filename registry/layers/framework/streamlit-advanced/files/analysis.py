import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(page_title="Analysis", page_icon=":microscope:", layout="wide")


@st.cache_data(ttl=600)
def load_sample() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "segment": ["A", "B", "C", "D", "E"],
            "users": [1200, 950, 780, 640, 410],
            "revenue": [48_000, 31_500, 22_100, 18_900, 9_400],
        }
    )


st.title("Analysis")
st.caption("Secondary page registered via the `pages/` convention.")

df = load_sample()

picked = st.multiselect(
    "Segments",
    options=df["segment"].tolist(),
    default=df["segment"].tolist(),
)
view = df[df["segment"].isin(picked)]

left, right = st.columns(2)
with left:
    st.subheader("Users by segment")
    st.plotly_chart(px.bar(view, x="segment", y="users"), use_container_width=True)
with right:
    st.subheader("Revenue by segment")
    st.plotly_chart(px.bar(view, x="segment", y="revenue"), use_container_width=True)

st.divider()
st.dataframe(view, use_container_width=True)
