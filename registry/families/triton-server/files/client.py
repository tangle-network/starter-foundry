"""Triton client — hits the HTTP (KServe v2) endpoint on port {{port}}.

Smoke-tests the `identity` model shipped in model_repository/. Swap
`MODEL_NAME` and the input shape once you drop real weights in.
"""

from __future__ import annotations

import os
import sys

import numpy as np
import tritonclient.http as httpclient


TRITON_URL = os.environ.get("TRITON_URL", "localhost:{{port}}")
MODEL_NAME = os.environ.get("MODEL_NAME", "identity")


def ensure_ready(client: httpclient.InferenceServerClient) -> None:
    if not client.is_server_live():
        raise RuntimeError(f"Triton not live at {TRITON_URL}")
    if not client.is_server_ready():
        raise RuntimeError(f"Triton not ready at {TRITON_URL}")
    if not client.is_model_ready(MODEL_NAME):
        meta = client.get_model_metadata(MODEL_NAME)
        raise RuntimeError(f"model {MODEL_NAME} not ready; metadata={meta}")


def main() -> int:
    client = httpclient.InferenceServerClient(url=TRITON_URL, verbose=False)

    try:
        ensure_ready(client)
    except Exception as exc:
        print(f"Triton not ready: {exc}", file=sys.stderr)
        print("Did `docker compose up -d` finish? Check /v2/health/ready.", file=sys.stderr)
        return 1

    # The identity model echoes its input. 4 float32 elements, batch=1.
    input_data = np.array([[1.0, 2.0, 3.0, 4.0]], dtype=np.float32)
    inputs = [httpclient.InferInput("INPUT0", input_data.shape, "FP32")]
    inputs[0].set_data_from_numpy(input_data)
    outputs = [httpclient.InferRequestedOutput("OUTPUT0")]

    response = client.infer(model_name=MODEL_NAME, inputs=inputs, outputs=outputs)
    result = response.as_numpy("OUTPUT0")
    print(f"input : {input_data.flatten().tolist()}")
    print(f"output: {result.flatten().tolist()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
