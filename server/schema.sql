CREATE TABLE IF NOT EXISTS subscribers (
 id BIGSERIAL PRIMARY KEY,
 email TEXT NOT NULL UNIQUE,
 phone TEXT UNIQUE,
 email_verified_at TIMESTAMPTZ,
 phone_verified_at TIMESTAMPTZ,
 email_consent_at TIMESTAMPTZ,
 sms_consent_at TIMESTAMPTZ,
 consent_version TEXT NOT NULL,
 consent_source TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 unsubscribed_email_at TIMESTAMPTZ,
 unsubscribed_sms_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS verifications (
 id BIGSERIAL PRIMARY KEY,
 subscriber_id BIGINT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
 channel TEXT NOT NULL CHECK (channel IN ('email','sms')),
 code_digest TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 consumed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_lookup ON verifications(subscriber_id,channel,created_at DESC);
CREATE TABLE IF NOT EXISTS consent_events (
 id BIGSERIAL PRIMARY KEY,
 subscriber_id BIGINT NOT NULL REFERENCES subscribers(id),
 channel TEXT NOT NULL,
 event_type TEXT NOT NULL,
 consent_version TEXT NOT NULL,
 source TEXT NOT NULL,
 happened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS campaigns(
 id BIGSERIAL PRIMARY KEY,
 subject TEXT NOT NULL,
 body TEXT NOT NULL,
 channel TEXT NOT NULL CHECK(channel IN('email','sms')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS deliveries(
 id BIGSERIAL PRIMARY KEY,
 campaign_id BIGINT NOT NULL REFERENCES campaigns(id),
 subscriber_id BIGINT NOT NULL REFERENCES subscribers(id),
 status TEXT NOT NULL,
 error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(campaign_id,subscriber_id)
);
