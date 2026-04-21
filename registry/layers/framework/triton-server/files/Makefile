.PHONY: install install-dev typecheck lint client up logs health

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
	docker compose logs -f triton

health:
	curl -f http://localhost:8000/v2/health/ready
