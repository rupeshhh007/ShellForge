FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8010
WORKDIR /app
COPY services/api/requirements.txt /app/services/api/requirements.txt
RUN pip install --no-cache-dir -r services/api/requirements.txt \
    && test -x /bin/bash \
    && useradd --uid 10001 --no-create-home shellforge
COPY src/__init__.py src/safety_validator.py /app/src/
COPY services/__init__.py /app/services/__init__.py
COPY services/api /app/services/api
USER 10001
EXPOSE 8010
CMD ["python", "-m", "services.api.serve"]
