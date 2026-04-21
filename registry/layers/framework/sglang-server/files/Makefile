.PHONY: install install-dev typecheck lint client up logs

install:
	pip install -r requirements.txt

install-dev:
	pip install -e ".[dev]"

typecheck:
	pyright src/

lint:
	ruff check src/

client:
	python -m src.client

up:
	docker compose up -d

logs:
	docker compose logs -f sglang
