exports.up = function (knex, Promise) {

    return knex.schema
  
    .createTable('agency_entry', function(table) {
      table.bigincrements('id').primary();
      table.timestamps();
      table.string('agency_key')
        .notNullable().unique();
    })
    
    .createTable('agency', function(table) {
      table.bigincrements('id').primary();
      table.biginteger('agency_entry_id').unsigned().notNullable()
        .references('id').inTable('agency_entry').onDelete('CASCADE')
        .index();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.string('agency_id')
        .notNullable();
      table.string('agency_name')
        .notNullable();
      table.string('agency_url')
        .notNullable();
      table.string('agency_timezone')
        .notNullable();
      table.string('agency_lang');
      table.string('agency_phone');
      table.string('agency_fare_url');
      table.timestamp('last_update');
      
      // agency_id is dataset unique.
      table.unique(['agency_entry_id', 'agency_id']);
    })
    
    .createTable('stop', function(table) {
      table.bigincrements('id').primary();
      table.biginteger('agency_entry_id')
        .unsigned().notNullable()
        .references('id').inTable('agency_entry').onDelete('CASCADE')
        .index();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
                        
      table.string('stop_id')
        .notNullable()
        .index();
      table.string('stop_code');
      table.string('stop_name')
        .notNullable();
      table.string('stop_desc');
      table.decimal('stop_lat', 16, 13)
        .notNullable();
      table.decimal('stop_lon', 16, 13)
        .notNullable();
      table.string('zone_id');
      table.string('stop_url');

      table.integer('location_type');
      table.string('parent_station');
      table.string('stop_timezone');
      table.integer('wheelchair_boarding');
      
      table.string('platform_code'); // Google Transit Extension
      
      //table.string('stop_street');
      //table.string('stop_city');
      //table.string('stop_region');
      //table.string('stop_postcode');
      //table.string('stop_country');
      
      // stop_id is dataset unique.
      table.unique(['agency_entry_id', 'stop_id']);
    })

    .createTable('route', function(table) {
      table.bigincrements('id').primary();
      table.biginteger('agency_entry_id')
        .unsigned().notNullable()
        .references('id').inTable('agency_entry').onDelete('CASCADE')
        .index();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.string('route_id')
        .index();
      table.biginteger('agency_id')
        .unsigned()
        .references('id').inTable('agency').onDelete('CASCADE')
        .index();
      table.string('route_short_name')
        .notNullable();
      table.string('route_long_name')
        .notNullable();
      table.string('route_desc');
      table.integer('route_type')
        .notNullable();
      table.string('route_url');
      table.string('route_color');
      table.string('route_text_color');
      
      // route_id is dataset unique.
      table.unique(['agency_entry_id', 'route_id']);
    })
    
    .createTable('service', function(table) {
      table.bigincrements('id').primary();
      table.biginteger('agency_entry_id')
        .unsigned().notNullable()
        .references('id').inTable('agency_entry').onDelete('CASCADE')
        .index();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.string('service_id')
        .notNullable()
        .index();

        // service_id is dataset unique.
        table.unique(['agency_entry_id', 'service_id']);
    })
    
    .createTable('calendar', function(table) {
      table.bigincrements('id').primary();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.biginteger('service_id')
        .unsigned().notNullable()
        .references('id').inTable('service').onDelete('CASCADE')
        .index();
      table.integer('monday')
        .notNullable();
      table.integer('tuesday')
        .notNullable();
      table.integer('wednesday')
        .notNullable();
      table.integer('thursday')
        .notNullable();
      table.integer('friday')
        .notNullable();
      table.integer('saturday')
        .notNullable();
      table.integer('sunday')
        .notNullable();
      table.timestamp('start_date')
        .notNullable();
      table.timestamp('end_date')
        .notNullable();
    })

    .createTable('calendar_date', function(table) {
      table.bigincrements('id').primary();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.biginteger('service_id')
        .unsigned().notNullable()
        .references('id').inTable('service').onDelete('CASCADE')
        .index();
      table.timestamp('date')
        .notNullable();
      table.integer('exception_type')
        .notNullable();
    })

    .createTable('shape', function(table) {
      table.bigincrements('id').primary();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      table.string('shape_id')
        .notNullable();
    })

    .createTable('shape_sequence', function(table) {
      table.bigincrements('id').primary();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.biginteger('shape_id')
        .unsigned().notNullable()
        .references('id').inTable('shape').onDelete('CASCADE')
        .index();
      table.decimal('shape_pt_lat', 16, 13)
        .notNullable();
      table.decimal('shape_pt_lon', 16, 13)
        .notNullable();
      table.integer('shape_pt_sequence')
        .notNullable();
      table.decimal('shape_dist_traveled', 24, 11);
    })
    
    .createTable('trip', function(table) {
      table.bigincrements('id').primary();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Keep reference to the agency entry for easy removal.
      table.biginteger('agency_entry_id')
        .unsigned().notNullable()
        .references('id').inTable('agency_entry').onDelete('CASCADE')
        .index();

      table.string('trip_id')
        .notNullable()
        .index();
      table.biginteger('route_id')
        .unsigned().notNullable()
        .references('id').inTable('route').onDelete('CASCADE')
        .index();
      table.biginteger('service_id')
        .unsigned().notNullable()
        .references('id').inTable('service').onDelete('CASCADE')
        .index();
      table.string('trip_headsign');
      table.string('trip_short_name');
      table.integer('direction_id');
      table.string('block_id');
      table.biginteger('shape_id')
        .unsigned()
        .references('id').inTable('shape').onDelete('CASCADE')
        .index();
      table.integer('wheelchair_accessible');
      table.integer('bikes_allowed');

      // trip_id is dataset unique.
      table.unique(['agency_entry_id', 'trip_id']);
    })

    .createTable('stop_time', function(table) {
      table.bigincrements('id').primary();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Keep reference to the agency entry for easy removal.
      table.string('arrival_time');
      table.string('departure_time');
      table.biginteger('agency_entry_id')
        .unsigned().notNullable()
        .references('id').inTable('agency_entry').onDelete('CASCADE')
        .index();
      
      table.biginteger('trip_id')
        .unsigned().notNullable()
        .references('id').inTable('trip').onDelete('CASCADE')
        .index();
      table.biginteger('stop_id')
        .unsigned().notNullable()
        .references('id').inTable('stop').onDelete('CASCADE')
        .index();
      table.integer('stop_sequence');
      table.string('stop_headsign');
      table.integer('pickup_type');
      table.integer('drop_off_time');  // In seconds, unofficial (?)
      table.integer('drop_off_type');
      table.decimal('shape_dist_traveled', 24, 11);
      table.integer('timepoint');
      
      // Unofficial: Used for convenience.
      //table.biginteger('_stop_id').unsigned().notNullable().references('id').inTable('stop').onDelete('CASCADE').index();
    })

    //.createTable('fare_attribute', function(table) {
    //  table.bigincrements('id').primary();
    //  table.timestamp('created_at').defaultTo(knex.fn.now());
    //  table.timestamp('updated_at').defaultTo(knex.fn.now());
    //
    //  table.string('fare_id').notNullable();
    //  table.decimal('price', 8, 2).notNullable();
    //  table.string('currency_type').notNullable();
    //  table.integer('payment_method').notNullable();
    //  table.integer('transfers').notNullable();
    //  table.integer('transfer_duration');
    //  
    //  // TODO: Google Transit Extension: agency_id, transfers
    //})

    //.createTable('fare_rule', function(table) {
    //  table.bigincrements('id').primary();
    //  table.timestamp('created_at').defaultTo(knex.fn.now());
    //  table.timestamp('updated_at').defaultTo(knex.fn.now());
    //
    //  table.string('fare_id').notNullable();
    //  table.string('route_id');  // OPT REFERENCE: route
    //  table.string('origin_id');
    //  table.string('destination_id');
    //  table.string('contains_id');
    //})

    //.createTable('frequency', function(table) {
    //  table.bigincrements('id').primary();
    //  table.timestamp('created_at').defaultTo(knex.fn.now());
    //  table.timestamp('updated_at').defaultTo(knex.fn.now());
    //
    //  table.string('trip_id').notNullable();
    //  table.string('start_time').notNullable();
    //  table.string('end_time').notNullable();
    //  table.integer('headway_secs').notNullable();
    //  table.integer('exact_times');
    //})

    //.createTable('transfer', function(table) {
    //  table.bigincrements('id').primary();
    //  table.timestamp('created_at').defaultTo(knex.fn.now());
    //  table.timestamp('updated_at').defaultTo(knex.fn.now());
    //
    //  table.string('from_stop_id'); // REFERENCE: stop
    //  table.string('to_stop_id'); // REFERENCE: stop
    //  table.integer('transfer_type').notNullable();
    //  table.integer('min_transfer_time');
    //})

    //.createTable('feed_info', function(table) {
    //  table.bigincrements('id').primary();
    //  table.timestamp('created_at').defaultTo(knex.fn.now());
    //  table.timestamp('updated_at').defaultTo(knex.fn.now());
    //
    //  table.string('feed_publisher_name').notNullable();
    //  table.string('feed_publisher_url').notNullable();
    //  table.string('feed_lang').notNullable();
    //  table.string('feed_start_date');
    //  table.string('feed_end_date');
    //  table.string('feed_version');
    //})
    ;
};

exports.down = function (knex, Promise) {
  return knex.schema
    .dropTableIfExists('stop_time')
    .dropTableIfExists('trip')
    .dropTableIfExists('shape_sequence')
    .dropTableIfExists('shape')
    .dropTableIfExists('calendar_date')
    .dropTableIfExists('calendar')
    .dropTableIfExists('service')
    .dropTableIfExists('route')
    .dropTableIfExists('stop')
    .dropTableIfExists('agency')
    .dropTableIfExists('agency_entry')
  ;
};
