from flask import Flask, jsonify, make_response, render_template, request, url_for
import os
from uuid import uuid4
from dotenv import load_dotenv
from pyairtable import Api
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'change-me-in-production')

AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')
AIRTABLE_BASE_ID = os.getenv('AIRTABLE_BASE_ID')
AIRTABLE_TABLE_ID = os.getenv('AIRTABLE_TABLE_ID')
AIRTABLE_REVERSE_ID = os.getenv('AIRTABLE_REVERSE_ID', '').strip()
AIRTABLE_USERS_TABLE_ID = os.getenv('AIRTABLE_USERS_TABLE_ID', '').strip()


def _require_env(*keys):
    missing = [key for key in keys if not os.getenv(key)]
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")


def _form(key):
    return (request.form.get(key) or '').strip()


def _render_error(template, error, **ctx):
    return render_template(template, error=str(error), **ctx), 400

def _record_payload(record):
    return {
        'id': record['id'],
        'fields': record['fields']
    }


def _json_error(error):
    return jsonify({'error': str(error), 'status': 'error'}), 400


def _products_table():
    """Return products table object or raise if env config is missing."""
    _require_env('AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'AIRTABLE_TABLE_ID')
    api = Api(AIRTABLE_API_KEY)
    return api.table(AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID)


def _reverse_table():
    """Return reverse table object or raise if env config is missing."""
    _require_env('AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'AIRTABLE_REVERSE_ID')
    api = Api(AIRTABLE_API_KEY)
    return api.table(AIRTABLE_BASE_ID, AIRTABLE_REVERSE_ID)


def _get_buyer_name_lookup():
    if not AIRTABLE_USERS_TABLE_ID:
        return {}
    try:
        users_tbl = Api(AIRTABLE_API_KEY).table(AIRTABLE_BASE_ID, AIRTABLE_USERS_TABLE_ID)
        return {
            user['id']: user.get('fields', {}).get('Name', '')
            for user in users_tbl.all(fields=['Name'])
        }
    except Exception:
        return {}


def _resolve_buyer_name(fields, buyer_lookup):
    buyer = fields.get('Buyer')

    if isinstance(buyer, list) and buyer:
        names = [buyer_lookup.get(bid, str(bid)) for bid in buyer]
        names = [name for name in names if name]
        return ', '.join(names) if names else 'Unknown buyer'

    if buyer:
        return str(buyer)

    return 'Unknown buyer'


def _get_reverse_items():
    records = _reverse_table().all()
    buyer_lookup = _get_buyer_name_lookup()
    items = []

    for record in records:
        payload = _record_payload(record)
        fields = payload.get('fields', {})
        fields['BuyerName'] = _resolve_buyer_name(fields, buyer_lookup)
        items.append(payload)

    return items


def _get_product_and_sellers(record_id):
    table = _products_table()
    record = table.get(record_id)
    seller_value = record.get('fields', {}).get('Seller')
    seller_names = []

    if isinstance(seller_value, list):
        for sid in seller_value:
            try:
                srec = table.get(sid)
                sname = srec.get('fields', {}).get('Name')
                seller_names.append(sname if sname else str(sid))
            except Exception:
                seller_names.append(str(sid))
    elif seller_value:
        seller_names = [str(seller_value)]

    return record, seller_names

@app.route('/')
def index():
    resp = make_response(render_template('index.html'))
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return resp


@app.route('/explore')
def explore():
    try:
        table = _products_table()
        records = table.all()
        return render_template('explore.html', records=records)
    except Exception as e:
        return _render_error('explore.html', e, records=[])


@app.route('/reverse', methods=['GET'])
    try:
        requests = _get_reverse_items()
        return render_template('reverse.html', requests=requests)
    except Exception as e:
        return _render_error('reverse.html', e, requests=[])


@app.route('/reverse/<record_id>', methods=['GET', 'POST'])
def reverse_listing_page(record_id):
    try:
        record = _reverse_table().get(record_id)
        listing = dict(record.get('fields', {}))
        listing['BuyerName'] = _resolve_buyer_name(listing, _get_buyer_name_lookup())
    except Exception as e:
        return _render_error('reverse_listing.html', e, listing=None)

    if request.method == 'POST':
        full_name = _form('full_name')
        email = _form('email')
        offer_price = _form('offer_price')
        message = _form('message')

        if not full_name or not email:
            return render_template(
                'reverse_listing.html',
                listing=listing,
                error='Name and email are required.',
                submitted=False
            ), 400

        return render_template(
            'reverse_listing.html',
            listing=listing,
            submitted=True,
            submitted_name=full_name,
            submitted_email=email,
            submitted_offer_price=offer_price,
            submitted_message=message
        )

    return render_template('reverse_listing.html', listing=listing, submitted=False)


@app.route('/add-reverse', methods=['GET', 'POST'])
def add_reverse():
    if request.method == 'POST':
        buyer_name = _form('buyer_name')
        item_name = _form('item_name')
        budget = _form('budget')
        category = _form('category')
        details = _form('details')

        if not item_name:
            return render_template('add_reverse.html', error='Please fill in at least the item name.', submitted=False), 400

        try:
            fields = {'Title': item_name}
            if budget:
                fields['Budget'] = float(budget)
            if category:
                fields['Category'] = category

            description_parts = []
            if buyer_name:
                description_parts.append(f'From: {buyer_name}')
            if details:
                description_parts.append(details)
            if description_parts:
                fields['Description'] = '\n\n'.join(description_parts)

            _reverse_table().create(fields)
        except Exception as e:
            return _render_error('add_reverse.html', e, submitted=False)

        return render_template('add_reverse.html', submitted=True)

    return render_template('add_reverse.html', submitted=False)


@app.route('/add-listing', methods=['GET', 'POST'])
def add_listing():
    if request.method == 'POST':
        name = _form('name')
        category = _form('category')
        price = _form('price')
        description = _form('description')
        condition = _form('condition')
        photo_file = request.files.get('photo_file')

        if not name or not category or not price:
            return render_template('add_listing.html', error='Name, category, and price are required.', submitted=False), 400

        if not photo_file or not photo_file.filename:
            return render_template('add_listing.html', error='At least one image is required.', submitted=False), 400

        _, ext = os.path.splitext(secure_filename(photo_file.filename))
        ext = ext.lower()
        if ext not in ALLOWED_EXTENSIONS:
            return render_template('add_listing.html', error='Image must be JPG, PNG, WEBP, or GIF.', submitted=False), 400

        upload_dir = os.path.join(app.static_folder, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        filename = f"{uuid4().hex}{ext}"
        photo_file.save(os.path.join(upload_dir, filename))
        photo_url = url_for('static', filename=f'uploads/{filename}', _external=True)

        try:
            table = _products_table()
            fields = {
                'Name': name,
                'Category': category,
                'Price': int(price),
                'Status': 'Review in progress',
                'Photo': [{'url': photo_url}]
            }
            if description:
                fields['Description'] = description
            if condition:
                fields['Condition'] = condition

            record = table.create(fields)
            return render_template('add_listing.html', submitted=True, record_id=record.get('id'))
        except Exception as e:
            return _render_error('add_listing.html', e, submitted=False)

    return render_template('add_listing.html', submitted=False)


@app.route('/saved')
def saved_items():
    return render_template('saved.html')


@app.route('/settings')
def settings_page():
    return render_template('settings.html')


@app.route('/api/airtable/reverse-records', methods=['GET'])
def api_get_reverse_records():
    try:
        items = _get_reverse_items()
        return jsonify({'records': items, 'status': 'success', 'count': len(items)})
    except Exception as e:
        return _json_error(e)


@app.route('/api/airtable/records', methods=['GET'])
def api_get_records():
    try:
        table = _products_table()
        records = table.all()
        records_list = [_record_payload(record) for record in records]
        return jsonify({
            'records': records_list,
            'status': 'success',
            'count': len(records_list)
        })
    except Exception as e:
        return _json_error(e)


@app.route('/api/airtable/records', methods=['POST'])
def api_add_record():
    try:
        table = _products_table()
        data = request.get_json()
        fields = data.get('fields', data)
        record = table.create(fields)
        return jsonify({
            'record': _record_payload(record),
            'status': 'success'
        })
    except Exception as e:
        return _json_error(e)


@app.route('/api/airtable/records/<record_id>', methods=['DELETE'])
def api_delete_record(record_id):
    try:
        table = _products_table()
        table.delete(record_id)
        return jsonify({
            'status': 'success',
            'deleted': record_id
        })
    except Exception as e:
        return _json_error(e)


@app.route('/product/<record_id>')
def product_page(record_id):
    try:
        record, seller_names = _get_product_and_sellers(record_id)
        return render_template('product.html', record=record, seller_names=seller_names)
    except Exception as e:
        return _render_error('product.html', e, record=None)


@app.route('/product/<record_id>/offer', methods=['GET', 'POST'])
def make_offer(record_id):
    try:
        record, seller_names = _get_product_and_sellers(record_id)
    except Exception as e:
        return _render_error('offer.html', e, record=None, seller_names=[])

    if request.method == 'POST':
        full_name = _form('full_name')
        email = _form('email')
        offer_price = _form('offer_price')
        message = _form('message')

        if not full_name or not email or not offer_price:
            return render_template(
                'offer.html',
                record=record,
                seller_names=seller_names,
                error='Name, email, and offer price are required.',
                submitted=False
            ), 400

        return render_template(
            'offer.html',
            record=record,
            seller_names=seller_names,
            submitted=True,
            submitted_name=full_name,
            submitted_email=email,
            submitted_offer=offer_price,
            submitted_message=message
        )

    return render_template(
        'offer.html',
        record=record,
        seller_names=seller_names,
        submitted=False
    )


@app.route('/product/<record_id>/buy', methods=['GET', 'POST'])
def buy_product(record_id):
    try:
        record, seller_names = _get_product_and_sellers(record_id)
    except Exception as e:
        return _render_error('product_action.html', e, record=None, seller_names=[], action_type='buy', action_label='Buy the product')

    if request.method == 'POST':
        full_name = _form('full_name')
        email = _form('email')
        message = _form('message')

        if not full_name or not email:
            return render_template(
                'product_action.html',
                record=record,
                seller_names=seller_names,
                action_type='buy',
                action_label='Buy the product',
                error='Name and email are required.',
                submitted=False
            ), 400

        return render_template(
            'product_action.html',
            record=record,
            seller_names=seller_names,
            action_type='buy',
            action_label='Buy the product',
            submitted=True,
            submitted_name=full_name,
            submitted_email=email,
            submitted_message=message
        )

    return render_template(
        'product_action.html',
        record=record,
        seller_names=seller_names,
        action_type='buy',
        action_label='Buy the product',
        submitted=False
    )


@app.route('/product/<record_id>/message', methods=['GET', 'POST'])
def message_seller(record_id):
    try:
        record, seller_names = _get_product_and_sellers(record_id)
    except Exception as e:
        return _render_error('message_seller.html', e, record=None, seller_names=[])

    if request.method == 'POST':
        full_name = _form('full_name')
        email = _form('email')
        message = _form('message')

        if not full_name or not email:
            return render_template(
                'message_seller.html',
                record=record,
                seller_names=seller_names,
                error='Name and email are required.',
                submitted=False
            ), 400

        return render_template(
            'message_seller.html',
            record=record,
            seller_names=seller_names,
            submitted=True,
            submitted_email=email,
            submitted_name=full_name,
            submitted_message=message
        )

    return render_template('message_seller.html', record=record, seller_names=seller_names, submitted=False)

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5001, debug=True)
