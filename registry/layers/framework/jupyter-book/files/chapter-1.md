---
jupytext:
  text_representation:
    extension: .md
    format_name: myst
kernelspec:
  display_name: Python 3
  language: python
  name: python3
---

# Chapter 1: Your first executable chapter

This chapter is written in [MyST Markdown](https://mystmd.org/). It can
embed executable code blocks that Jupyter Book runs at build time.

```{code-cell} python
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 2 * np.pi, 256)
plt.plot(x, np.sin(x))
plt.title("sin(x) on [0, 2π]")
plt.tight_layout()
plt.show()
```

Swap this for real content, or add a `.ipynb` file and list it in
`_toc.yml`. Anything in a code cell runs under the Python environment
from `requirements.txt`.
