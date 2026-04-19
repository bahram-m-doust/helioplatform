import ssl
import urllib.error
from unittest.mock import patch

from apps.agents.video_generator import api as video_api
from rest_framework import status
from rest_framework.test import APITestCase


class ImagePromptApiTests(APITestCase):
    def test_requires_user_request(self):
        response = self.client.post('/api/ai/image/prompt/', {'brand': 'Mansory'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('user_request', response.data.get('detail', ''))

    @patch('apps.agents.image_generator.api._openrouter_chat', return_value='Clean final image prompt')
    def test_success_shape(self, _mock_openrouter_chat):
        response = self.client.post(
            '/api/ai/image/prompt/',
            {'brand': 'Mansory', 'user_request': 'showroom'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('status'), 'ok')
        self.assertEqual(response.data.get('final_prompt'), 'Clean final image prompt')

    @patch(
        'apps.agents.image_generator.api._openrouter_chat',
        side_effect=RuntimeError('openai/gpt-4o upstream temporarily unavailable'),
    )
    def test_provider_error_is_sanitized(self, _mock_openrouter_chat):
        response = self.client.post(
            '/api/ai/image/prompt/',
            {'brand': 'Mansory', 'user_request': 'showroom'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(
            response.data.get('detail'),
            'Image prompt generation failed upstream. Please retry in a few seconds.',
        )


class ImageGenerationApiTests(APITestCase):
    @patch('apps.agents.image_generator.api.get_replicate_token', return_value='')
    def test_missing_token(self, _mock_token):
        response = self.client.post(
            '/api/ai/image/generate/',
            {'prompt': 'test', 'image_input': []},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn('REPLICATE_API_TOKEN', response.data.get('detail', ''))

    @patch('apps.agents.image_generator.api.get_replicate_token', return_value='token')
    def test_instruction_dump_is_rejected(self, _mock_token):
        dumped_prompt = 'You are a subject-first visual prompt architect. Primary objective.'
        response = self.client.post(
            '/api/ai/image/generate/',
            {'prompt': dumped_prompt, 'image_input': []},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Prompt validation failed', response.data.get('detail', ''))

    @patch('apps.agents.image_generator.api.get_replicate_token', return_value='token')
    @patch('apps.agents.image_generator.api.get_replicate_model', return_value='bytedance/seedream-4.5')
    @patch('apps.agents.image_generator.api._json_request')
    def test_success_and_payload_contract(self, mock_json_request, _mock_model, _mock_token):
        captured_payloads = []

        def fake_json_request(method, _url, _headers, payload=None):
            if method == 'POST':
                captured_payloads.append(payload)
            return {
                'status': 'succeeded',
                'id': 'pred_1',
                'output': 'https://cdn.example.com/generated.png',
            }

        mock_json_request.side_effect = fake_json_request
        response = self.client.post(
            '/api/ai/image/generate/',
            {'prompt': 'Premium showroom render', 'image_input': ['https://cdn.example.com/logo.png']},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('status'), 'succeeded')
        self.assertEqual(response.data.get('image_url'), 'https://cdn.example.com/generated.png')
        self.assertTrue(captured_payloads)
        self.assertEqual(captured_payloads[0]['input'].get('aspect_ratio'), '16:9')


class VideoApiTests(APITestCase):
    def test_video_image_prompt_requires_user_request(self):
        response = self.client.post('/api/ai/video/image-prompt/', {'brand': 'Mansory'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('user_request', response.data.get('detail', ''))

    @patch('apps.agents.video_generator.api._openrouter_chat', return_value='Cinematic keyframe prompt')
    def test_video_image_prompt_success_shape(self, _mock_openrouter_chat):
        response = self.client.post(
            '/api/ai/video/image-prompt/',
            {'brand': 'Mansory', 'user_request': 'sports car ad shot'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('status'), 'ok')
        self.assertEqual(response.data.get('image_prompt'), 'Cinematic keyframe prompt')

    def test_prompt_from_image_requires_image_url(self):
        response = self.client.post(
            '/api/ai/video/prompt-from-image/',
            {'brand': 'Mansory', 'user_request': 'animate headlights'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('image_url', response.data.get('detail', ''))

    @patch('apps.agents.video_generator.api._openrouter_chat', return_value='Smooth motion prompt')
    def test_prompt_from_image_success_shape(self, _mock_openrouter_chat):
        response = self.client.post(
            '/api/ai/video/prompt-from-image/',
            {
                'brand': 'Mansory',
                'user_request': 'animate headlights',
                'image_url': 'https://cdn.example.com/start.png',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('status'), 'ok')
        self.assertEqual(response.data.get('video_prompt'), 'Smooth motion prompt')

    @patch('apps.agents.video_generator.api.get_replicate_token', return_value='token')
    @patch('apps.agents.video_generator.api.get_replicate_video_model', return_value='kwaivgi/kling-v2.5-turbo-pro')
    @patch('apps.agents.video_generator.api._json_request')
    def test_video_generation_success_and_payload_contract(self, mock_json_request, _mock_model, _mock_token):
        captured_payloads = []

        def fake_json_request(method, _url, _headers, payload=None):
            if method == 'POST':
                captured_payloads.append(payload)
            return {
                'status': 'succeeded',
                'id': 'video_1',
                'output': 'https://cdn.example.com/generated.mp4',
            }

        mock_json_request.side_effect = fake_json_request
        response = self.client.post(
            '/api/ai/video/generate/',
            {
                'video_prompt': 'Cinematic motion',
                'image_url': 'https://cdn.example.com/start.png',
                'duration': 5,
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('status'), 'succeeded')
        self.assertEqual(response.data.get('video_url'), 'https://cdn.example.com/generated.mp4')
        self.assertTrue(captured_payloads)
        self.assertEqual(captured_payloads[0]['input'].get('aspect_ratio'), '16:9')

    @patch('apps.agents.video_generator.api.get_replicate_token', return_value='token')
    @patch(
        'apps.agents.video_generator.api._json_request',
        side_effect=RuntimeError('kling upstream temporary issue'),
    )
    def test_video_generation_provider_error_is_sanitized(self, _mock_request, _mock_token):
        response = self.client.post(
            '/api/ai/video/generate/',
            {'video_prompt': 'motion', 'image_url': 'https://cdn.example.com/start.png'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(
            response.data.get('detail'),
            'Video rendering failed upstream. Please retry in a few seconds.',
        )

    @patch('apps.agents.video_generator.api.time.sleep', return_value=None)
    @patch('apps.agents.video_generator.api.urllib.request.urlopen')
    def test_video_json_request_retries_transient_ssl_eof(self, mock_urlopen, mock_sleep):
        class _FakeResponse:
            def __init__(self, content: str):
                self._content = content

            def read(self):
                return self._content.encode('utf-8')

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc_val, exc_tb):
                return False

        transient_ssl_error = urllib.error.URLError(
            ssl.SSLEOFError(8, 'EOF occurred in violation of protocol (_ssl.c:1006)')
        )
        mock_urlopen.side_effect = [
            transient_ssl_error,
            _FakeResponse('{"status":"ok"}'),
        ]

        response = video_api._json_request('GET', 'https://example.com', headers={})

        self.assertEqual(response.get('status'), 'ok')
        self.assertEqual(mock_urlopen.call_count, 2)
        mock_sleep.assert_called_once()
