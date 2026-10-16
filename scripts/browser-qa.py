from pathlib import Path
import json, argparse, os
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parent.parent
options = argparse.ArgumentParser()
options.add_argument('--model', action='store_true', help='Also make one real DeepSeek preparation through the local UI')
args = options.parse_args()
out = root / 'work' / 'browser-qa'
out.mkdir(parents=True, exist_ok=True)
errors = []
api_bodies = []
model_result = None
origin = 'http://127.0.0.1:4318'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('BROWSER_EXECUTABLE', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'), headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1050}, device_scale_factor=1, reduced_motion='reduce')
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', lambda r: api_bodies.append(r.text()) if '/api/' in r.url else None)
    page.goto(origin, wait_until='networkidle')
    assert page.locator('[data-add]').count() == 6
    page.locator('#menu-expand').click()
    assert page.locator('[data-add]').count() == 37
    page.locator('#menu-expand').click()
    page.screenshot(path=str(out / '桌面-v02.png'), full_page=True)
    # A smaller portion cannot produce a valid cheaper result.
    page.locator('[data-variant="chicken-set"]').select_option('small')
    page.locator('[data-add="chicken-set"]').click()
    page.locator('#submit-plan').click()
    expect(page.locator('#info-dialog')).to_be_visible()
    assert '薯条（小）' in page.locator('#dialog-content').inner_text()
    page.locator('#dialog-close').click()
    page.locator('#cart-clear').click()
    page.locator('[data-add="chicken-fries"]').click()
    page.locator('[data-add="single-cola-m"]').click()
    assert page.locator('#cart-price').inner_text() == '¥25.90'
    page.locator('#submit-plan').click()
    page.locator('#reveal-button').click()
    expect(page.locator('#result-title')).to_contain_text('你更会点')
    with page.expect_download() as downloaded:
        page.locator('#save-result').click()
    downloaded.value.save_as(str(out / '战绩卡-v02.png'))
    assert (out / '战绩卡-v02.png').read_bytes()[:8] == b'\x89PNG\r\n\x1a\n'
    # Shared benchmark is recomputed, hidden until reveal, and independently playable.
    page.locator('#share-result').click()
    invitation_url = page.locator('#share-url').input_value()
    assert invitation_url.startswith(origin + '/#challenge=')
    page.locator('#dialog-close').click()
    friend = browser.new_page(viewport={'width': 1280, 'height': 900}, reduced_motion='reduce')
    friend.on('pageerror', lambda e: errors.append(str(e)))
    friend.goto(origin + '/#' + invitation_url.split('#', 1)[1], wait_until='networkidle')
    expect(friend.locator('#invitation-banner')).to_be_visible()
    assert friend.locator('.invitation-result').count() == 0
    friend.locator('[data-add="chicken-fries"]').click()
    friend.locator('[data-add="single-cola-m"]').click()
    friend.locator('#submit-plan').click()
    friend.locator('#reveal-button').click()
    expect(friend.locator('.invitation-result')).to_contain_text('¥25.90')
    expect(friend.locator('.invitation-result')).to_contain_text('同样划算')
    # A custom bag stays editable at its limit, then travels in a share link.
    page.locator('#custom-open').click()
    for food in ['chicken', 'beef', 'fries-m', 'cola-m', 'pie']:
        page.locator(f'[data-custom-food="{food}"]').click()
    assert '5 / 5' in page.locator('#free-count').inner_text()
    page.locator('[data-custom-food="chicken"]').click()
    assert '4 / 5' in page.locator('#free-count').inner_text()
    page.locator('#dialog-close').click()
    page.locator('#custom-open').click()
    page.locator('[data-custom-food="coffee"]').click()
    page.locator('[data-custom-food="pie"]').click()
    page.locator('#custom-confirm').click()
    page.locator('#share-challenge').click()
    custom_url = page.locator('#share-url').input_value()
    page.locator('#dialog-close').click()
    friend.goto(origin + '/#' + custom_url.split('#', 1)[1], wait_until='networkidle')
    assert friend.locator('#target-bag .target-item').count() == 2
    friend.locator('[data-add="coffee-pie"]').click()
    friend.locator('#submit-plan').click()
    friend.locator('#reveal-button').click()
    expect(friend.locator('#result-title')).to_contain_text('平局')
    # Optional actual model request, using the real locally saved API key.
    page.locator('[data-round="warmup"]').click()
    if args.model:
        page.locator('#opponent-switch').click()
        expect(page.locator('#choose-model')).to_be_enabled(timeout=10000)
        page.locator('#choose-model').click()
        expect(page.locator('#opponent-name')).to_have_text('DeepSeek', timeout=120000)
        assert page.locator('#cart-lines .cart-line').count() == 0
        page.locator('[data-add="chicken-fries"]').click()
        page.locator('[data-add="single-cola-m"]').click()
        page.locator('#submit-plan').click()
        with page.expect_response('**/api/model/reveal', timeout=120000) as response:
            page.locator('#reveal-button').click()
        value = response.value.json()
        expect(page.locator('#result-title')).to_be_visible(timeout=10000)
        expect(page.locator('.result-proof')).to_contain_text('对手餐单与开局时一致')
        model_result = {'status': 'passed', 'source': 'real DeepSeek API, fictional training prices', 'meta': value['opponentMeta'], 'playerCents': value['player']['quote']['totalCents'], 'opponentCents': value['opponent']['quote']['totalCents'], 'playerValid': value['player']['valid'], 'opponentValid': value['opponent']['valid'], 'uiCommitmentVerified': True}
        page.locator('#result-section').screenshot(path=str(out / 'DeepSeek对局-v02.png'))
    # Selection and closed-store recovery use fixtures; not a real availability claim.
    page.route('**/api/status', lambda route: route.fulfill(json={'tokenConfigured': True, 'liveEnabled': True, 'byokEnabled': True, 'deepseek': {'configured': False}}))
    stores = [{'storeCode': '2000001', 'storeName': '营业测试店', 'address': '测试地址', 'businessStatus': True, 'hours': '08:00–23:00'}, {'storeCode': '2000002', 'storeName': '闭店测试店', 'address': '', 'businessStatus': False, 'hours': ''}, {'storeCode': '2000003', 'storeName': '未知测试店', 'address': '', 'businessStatus': None, 'hours': ''}]
    page.route('**/api/live/stores', lambda route: route.fulfill(json={'stores': stores, 'checkedAt': 'fixture'}))
    def unavailable(route):
        assert route.request.post_data_json['storeCode'] == '2000001'
        route.fulfill(status=400, json={'error': '测试门店可能已关闭或不在营业时间（600057）'})
    page.route('**/api/live/prepare', unavailable)
    page.locator('#data-info').click()
    page.locator('#live-check').click()
    page.locator('#store-search').click()
    expect(page.locator('#store-results input[value="2000001"]')).to_be_checked()
    expect(page.locator('#store-results input[value="2000002"]')).to_be_disabled()
    expect(page.locator('#store-results input[value="2000003"]')).to_be_disabled()
    page.locator('[data-live-case="chicken"]').click()
    expect(page.locator('#live-prepare-feedback')).to_contain_text('不在营业时间')
    expect(page.locator('[data-live-case="chicken"]')).to_be_enabled()
    page.locator('#dialog-close').click()
    # The mobile cart is a drawer with one shared state and a persistent action bar.
    mobile = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1, reduced_motion='reduce', is_mobile=True, has_touch=True)
    mobile.on('pageerror', lambda e: errors.append(str(e)))
    mobile.goto(origin, wait_until='networkidle')
    mobile.locator('#arena').scroll_into_view_if_needed()
    expect(mobile.locator('#mobile-dock')).to_be_visible()
    assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    mobile.screenshot(path=str(out / '手机-v02.png'), full_page=True)
    mobile.locator('[data-add="chicken-fries"]').click()
    mobile.locator('[data-add="single-cola-m"]').click()
    expect(mobile.locator('#dock-count')).to_have_text('2')
    expect(mobile.locator('#dock-price')).to_have_text('¥25.90')
    mobile.locator('#dock-bag').click()
    expect(mobile.locator('#cart-dialog')).to_be_visible()
    mobile.locator('[data-quantity="0"][data-delta="1"]').click()
    expect(mobile.locator('#dock-count')).to_have_text('3')
    mobile.locator('[data-quantity="0"][data-delta="-1"]').click()
    mobile.screenshot(path=str(out / '餐袋抽屉-v02.png'))
    mobile.locator('#cart-dialog-close').click()
    mobile.locator('#dock-submit').click()
    expect(mobile.locator('#mobile-dock')).to_be_hidden()
    mobile.locator('#reveal-button').click()
    expect(mobile.locator('#result-title')).to_contain_text('你更会点')
    mobile.locator('[data-round="coupon"]').click()
    mobile.locator('[data-variant="chicken-set"]').select_option('zero')
    mobile.locator('[data-add="chicken-set"]').click()
    mobile.locator('#dock-bag').click()
    mobile.locator('#coupon-select').select_option('set-500')
    expect(mobile.locator('#dock-price')).to_have_text('¥24.90')
    mobile.locator('#cart-dialog-close').click()
    mobile.locator('#dock-submit').click()
    mobile.locator('#reveal-button').click()
    expect(mobile.locator('#result-title')).to_contain_text('平局')
    for width in [320, 760, 900, 1440]:
        mobile.set_viewport_size({'width': width, 'height': 900})
        assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), f'overflow at {width}'
    browser.close()

env_file = root / '.env'
for line in env_file.read_text(encoding='utf-8').splitlines() if env_file.exists() else []:
    if line.startswith(('MCD_MCP_TOKEN=', 'DEEPSEEK_API_KEY=')):
        secret = line.partition('=')[2].strip().strip('"').strip("'")
        if secret:
            assert all(secret not in body for body in api_bodies), 'A local credential reached a browser response'
assert not errors, errors
report = {'checkedAt': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(), 'desktop': 'passed', 'mobileDrawerAndDock': 'passed', 'responsiveWidths': [320,390,760,900,1440], 'trainingWinAndTie': 'passed', 'wrongSizeRejected': True, 'customRound': 'passed', 'shareBenchmarkAndCustom': 'passed', 'pngExport': 'passed', 'storeSelectionAndClosedRecovery': 'passed with fixtures', 'realDeepSeek': model_result or 'not requested', 'browserErrors': errors, 'credentialsAbsentFromBrowser': True}
(out / 'result-v02.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True))
