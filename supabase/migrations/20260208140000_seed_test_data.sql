-- Seed Test Data for Document Submission Service
-- This creates auth users, profiles, and tokens for testing

DO $$
DECLARE
  v_service_id UUID := '27123d9c-b62e-4853-8a56-59f729b5fdb6'; -- Document Submission
  v_test_user_1 UUID := '11111111-1111-1111-1111-111111111111';
  v_test_user_2 UUID := '22222222-2222-2222-2222-222222222222';
  v_test_user_3 UUID := '33333333-3333-3333-3333-333333333333';
BEGIN
  -- Insert test users into auth.users (requires service_role permissions)
  -- Note: Passwords are hashed with bcrypt, using 'password123' for all test users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  ) VALUES 
    (
      v_test_user_1,
      '00000000-0000-0000-0000-000000000000',
      'testuser1@example.com',
      '$2a$10$rKvVLPZEpZVZJZZZZZZZZeO1YxZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z', -- bcrypt hash of 'password123'
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Test User One"}',
      'authenticated',
      'authenticated'
    ),
    (
      v_test_user_2,
      '00000000-0000-0000-0000-000000000000',
      'testuser2@example.com',
      '$2a$10$rKvVLPZEpZVZJZZZZZZZZeO1YxZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z',
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Test User Two"}',
      'authenticated',
      'authenticated'
    ),
    (
      v_test_user_3,
      '00000000-0000-0000-0000-000000000000',
      'testuser3@example.com',
      '$2a$10$rKvVLPZEpZVZJZZZZZZZZeO1YxZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z',
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Test User Three"}',
      'authenticated',
      'authenticated'
    )
  ON CONFLICT (id) DO NOTHING;

  -- Insert corresponding identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES
    (v_test_user_1, v_test_user_1, '{"sub":"' || v_test_user_1 || '","email":"testuser1@example.com"}', 'email', NOW(), NOW(), NOW()),
    (v_test_user_2, v_test_user_2, '{"sub":"' || v_test_user_2 || '","email":"testuser2@example.com"}', 'email', NOW(), NOW(), NOW()),
    (v_test_user_3, v_test_user_3, '{"sub":"' || v_test_user_3 || '","email":"testuser3@example.com"}', 'email', NOW(), NOW(), NOW())
  ON CONFLICT (provider, id) DO NOTHING;

  -- Insert test profiles
  INSERT INTO public.profiles (id, full_name, email, masked_name)
  VALUES 
    (v_test_user_1, 'Test User One', 'testuser1@example.com', 'T***r 1'),
    (v_test_user_2, 'Test User Two', 'testuser2@example.com', 'T***r 2'),
    (v_test_user_3, 'Test User Three', 'testuser3@example.com', 'T***r 3')
  ON CONFLICT (id) DO NOTHING;

  -- Insert test tokens for Document Submission
  -- Token 1: Waiting (for test user 1)
  INSERT INTO public.tokens (token_number, service_id, status, estimated_wait, customer_id, created_at)
  VALUES 
    (101, v_service_id, 'waiting', 15, v_test_user_1, NOW() - INTERVAL '10 minutes');

  -- Token 2: Serving (for test user 2)
  INSERT INTO public.tokens (token_number, service_id, status, estimated_wait, customer_id, created_at, started_at)
  VALUES 
    (102, v_service_id, 'serving', 5, v_test_user_2, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '5 minutes');

  -- Token 3: Completed (for test user 3)
  INSERT INTO public.tokens (token_number, service_id, status, estimated_wait, customer_id, created_at, started_at, ended_at)
  VALUES 
    (103, v_service_id, 'completed', 0, v_test_user_3, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '40 minutes');

  -- Token 4: Another waiting token (no customer, anonymous)
  INSERT INTO public.tokens (token_number, service_id, status, estimated_wait, customer_id, created_at)
  VALUES 
    (104, v_service_id, 'waiting', 20, NULL, NOW() - INTERVAL '5 minutes');

  RAISE NOTICE 'Test data inserted successfully!';
  RAISE NOTICE 'Test Users:';
  RAISE NOTICE '  - testuser1@example.com (password: password123) - Has waiting token #101';
  RAISE NOTICE '  - testuser2@example.com (password: password123) - Has serving token #102';
  RAISE NOTICE '  - testuser3@example.com (password: password123) - Has completed token #103';
END $$;
