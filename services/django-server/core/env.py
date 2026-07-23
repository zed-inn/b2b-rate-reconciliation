from pydantic_settings import BaseSettings, SettingsConfigDict

class Env(BaseSettings):
    database_url: str = "postgres://postgres:postgres@localhost:5433/django_db"
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"
    django_host: str = "0.0.0.0"
    django_port: int = 8000
    django_debug: bool = False
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

env = Env()
