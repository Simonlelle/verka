from flask import Flask, render_template, request, jsonify, make_response
import os
from dotenv import load_dotenv
from pyairtable import Api

load_dotenv()

app = Flask(__name__)

AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')
AIRTABLE_BASE_ID = os.getenv('AIRTABLE_BASE_ID')
AIRTABLE_TABLE_ID = os.getenv('AIRTABLE_TABLE_ID')
AIRTABLE_REVERSE_ID = os.getenv('AIRTABLE_REVERSE_ID', '').strip()
AIRTABLE_USERS_TABLE_ID = os.getenv('AIRTABLE_USERS_TABLE_ID', '').strip()


def _get_reverse_table():
    if not AIRTABLE_API_KEY or not AIRTABLE_BASE_ID or not AIRTABLE_REVERSE_ID:
        raise ValueError('Missing AIRTABLE_REVERSE_ID configuration')
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


def _resolve_buyer_name(fields, buyer_names):
    buyer_ids = fields.get('Buyer') or []
    if not isinstance(buyer_ids, list):
        return None
    names = [buyer_names.get(buyer_id, '') for buyer_id in buyer_ids]
    names = [name for name in names if name]
    return ', '.join(names) or None


def _get_reverse_request_fields():
    records = _get_reverse_table().all()
    buyer_names = _get_buyer_name_lookup()
    requests = []
    for record in records:
        fields = dict(record.get('fields', {}))
        fields['BuyerName'] = _resolve_buyer_name(fields, buyer_names)
        requests.append(fields)
    return requests


def _get_reverse_request_payloads():
    records = _get_reverse_table().all()
    buyer_names = _get_buyer_name_lookup()
    payloads = []
    for record in records:
        payload = _record_payload(record)
        payload['fields']['BuyerName'] = _resolve_buyer_name(payload['fields'], buyer_names)
        payloads.append(payload)
    return payloads


def _record_payload(record):
    return {
        'id': record['id'],
        'fields': record['fields']
    }


def _json_error(error):
    return jsonify({'error': str(error), 'status': 'error'}), 400


def _get_table():
    """Return pyairtable Table object or raise ValueError if config missing."""
    if not AIRTABLE_API_KEY or not AIRTABLE_BASE_ID or not AIRTABLE_TABLE_ID:
        raise ValueError('Missing AIRTABLE configuration')
    api = Api(AIRTABLE_API_KEY)
    return api.table(AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID)


def _get_product_and_sellers(record_id):
    table = _get_table()
    record = table.get(record_id)
    seller_names = []

    seller_value = record.get('fields', {}).get('Seller')
    if isinstance(seller_value, list):
        for sid in seller_value:
            try:
                srec = table.get(sid)
                sname = srec.get('fields', {}).get('Name')
                seller_names.append(sname if sname else str(sid))
            except Exception:
                seller_names.append(str(sid))
    elif seller_value:
        seller_names.append(str(seller_value))

    return record, seller_names

@app.route('/')
def index():
    resp = make_response(render_template('index.html'))
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return resp


@app.route('/explore')
def explore():
    try:
        table = _get_table()
        records = table.all()
        return render_template('explore.html', records=records)
    except Exception as e:
        return render_template('explore.html', records=[], error=str(e)), 400


@app.route('/reverse', methods=['GET'])
def reverse_marketplace():
    try:
        return render_template('reverse.html', requests=_get_reverse_request_fields())
    except Exception:
        return render_template('reverse.html', requests=[])


@app.route('/add-reverse', methods=['GET', 'POST'])
def add_reverse():
    if request.method == 'POST':
        buyer_name = (request.form.get('buyer_name') or '').strip()
        item_name = (request.form.get('item_name') or '').strip()
        budget = (request.form.get('budget') or '').strip()
        category = (request.form.get('category') or '').strip()
        details = (request.form.get('details') or '').strip()

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
            _get_reverse_table().create(fields)
        except Exception as e:
            return render_template('add_reverse.html', error=str(e), submitted=False), 400

        return render_template('add_reverse.html', submitted=True)

    return render_template('add_reverse.html', submitted=False)


@app.route('/add-listing', methods=['GET', 'POST'])
def add_listing():
    if request.method == 'POST':
        name = (request.form.get('name') or '').strip()
        category = (request.form.get('category') or '').strip()
        price = (request.form.get('price') or '').strip()
        description = (request.form.get('description') or '').strip()
        condition = (request.form.get('condition') or '').strip()
        photo_url = (request.form.get('photo_url') or '').strip()

        if not name or not category or not price:
            return render_template('add_listing.html', error='Name, category, and price are required.', submitted=False), 400

        if not photo_url:
            return render_template('add_listing.html', error='At least one image is required.', submitted=False), 400

        if not (photo_url.startswith('http://') or photo_url.startswith('https://')):
            return render_template('add_listing.html', error='Image must be a valid URL (http/https).', submitted=False), 400

        try:
            table = _get_table()
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
            return render_template('add_listing.html', error=str(e), submitted=False), 400

    return render_template('add_listing.html', submitted=False)


@app.route('/saved')
def saved_items():
    return render_template('saved.html')


@app.route('/settings')
def settings_page():
    return render_template('settings.html')


@app.route('/api/airtable/reverse-records', methods=['GET'])
def get_reverse_records():
    try:
        return jsonify({'records': _get_reverse_request_payloads(), 'status': 'success'})
    except Exception as e:
        return _json_error(e)


@app.route('/api/airtable/records', methods=['GET'])
def get_airtable_records():
    try:
        table = _get_table()
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
def add_airtable_record():
    try:
        table = _get_table()
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
def delete_airtable_record(record_id):
    try:
        table = _get_table()
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
        return render_template('product.html', error=str(e), record=None), 400


@app.route('/product/<record_id>/<action_type>', methods=['GET', 'POST'])
def product_action(record_id, action_type):
    action_labels = {
        'offer': 'Make an offer',
        'buy': 'Buy the product',
        'message': 'Message seller'
    }

    if action_type not in action_labels:
        return make_response('Invalid action', 404)

    try:
        record, seller_names = _get_product_and_sellers(record_id)
    except Exception as e:
        return render_template('product_action.html', error=str(e), record=None, seller_names=[], action_type=action_type, action_label=action_labels[action_type]), 400

    if request.method == 'POST':
        full_name = (request.form.get('full_name') or '').strip()
        email = (request.form.get('email') or '').strip()
        message = (request.form.get('message') or '').strip()

        if not full_name or not email:
            return render_template(
                'product_action.html',
                record=record,
                seller_names=seller_names,
                action_type=action_type,
                action_label=action_labels[action_type],
                error='Name and email are required.',
                submitted=False
            ), 400

        return render_template(
            'product_action.html',
            record=record,
            seller_names=seller_names,
            action_type=action_type,
            action_label=action_labels[action_type],
            submitted=True,
            submitted_name=full_name,
            submitted_email=email,
            submitted_message=message
        )

    return render_template(
        'product_action.html',
        record=record,
        seller_names=seller_names,
        action_type=action_type,
        action_label=action_labels[action_type],
        submitted=False
    )


@app.route('/product/<record_id>/message', methods=['GET', 'POST'])
def message_seller(record_id):
    try:
        record, seller_names = _get_product_and_sellers(record_id)
    except Exception as e:
        return render_template('message_seller.html', error=str(e), record=None, seller_names=[]), 400

    if request.method == 'POST':
        full_name = (request.form.get('full_name') or '').strip()
        email = (request.form.get('email') or '').strip()
        message = (request.form.get('message') or '').strip()
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
