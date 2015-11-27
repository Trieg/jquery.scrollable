// amd.js

require( [

    'jquery',
    'underscore',
    'usertiming',
    'jquery.scrollable'

], function ( $, _, performance ) {

    $( function () {

        var $window = $( window ),
            $body = $( document.body ),

            $header = $( "#header" ),
            $controlsPane = $( ".scroll-controls" ),
            $modeControls = $( "a.mode", $controlsPane ),
            $movementControls = $( "a.shift, a.jump", $controlsPane ),

            $feedbackPane = $( ".feedback" ),
            $feedbackX_px = $( ".x-px", $feedbackPane ),
            $feedbackX_percent = $( ".x-percent", $feedbackPane ),
            $feedbackY_px = $( ".y-px", $feedbackPane ),
            $feedbackY_percent = $( ".y-percent", $feedbackPane ),

            $log = $( "#log", $feedbackPane );

        performance.clearMarks();
        performance.clearMeasures();

        // Make sure the document body is larger than the window by at least 2000px in each dimension
        $body
            .css( {
                minWidth:  ( $.windowWidth() + 2000 ) + "px",
                minHeight: ( $.windowHeight() + 2000 ) + "px"
            } );

        // Add a gradient background by injecting a "gradient background div". This is a terrible hack.
        //
        // Setting the gradient directly on the body didn't work as intended. The gradient just extended across the
        // screen, not across the full body size. Beyond the screen, the gradient was repeated, creating a pattern. Body
        // somehow seems to be confused with "window". Observed in Chrome 43 (May 2015).
        //
        // (Adding the gradient class after setting the final body size didn't change this, either.)
        $( "<div/>" ).appendTo( $body ).addClass( "maxed gradient" );

        // Hide the info header (if present), show controls
        if ( $header.length ) {
            $header.delay( 2000 ).fadeOut( 800, function () {
                $controlsPane.show();
            } );
        } else {
            $controlsPane.show();
        }

        // Clicks on controls should not stop an ongoing scroll animation. Keep events from propagating.
        $movementControls.on( "mousedown touchstart pointerdown", function ( event ) {
            event.stopPropagation();
        } );

        $modeControls.on( "mousedown touchstart pointerdown", function ( event ) {
            event.stopPropagation();
        } );

        // Wire up the movement controls
        $movementControls.click( function ( event ) {
            var chain,
                $elem = $( this ),
                chainData = $elem.data( "chain" ),
                scrollMode = chainData ? "append" : getScrollMode(),
                actionLabel = $elem.text(),

                config = {
                    duration: 2000,
                    append: scrollMode === "append",
                    merge: scrollMode === "merge",
                    lockSpeedBelow: 1500,
                    start: function ( animation ) {
                        var callId = _.uniqueId( "callId" );
                        animation._callId = callId;
                        performance.mark( callId + " - Start" );
                    },
                    done: function ( animation, jumpedToEnd, messages ) {
                        var execTime,
                            callId = animation._callId;

                        performance.measure( callId, callId + " - Start" );
                        execTime = getMeasuredDuration( callId, { rounded: true, unit: true } );

                        updateLog( actionLabel + " done.", true, " (" + execTime + ")" );
                    },
                    fail: function ( animation, jumpedToEnd, messages ) {
                        var cause = messages.cancelled,
                            addSeparator = cause === "scroll" || cause === "click";

                        updateLog ( "Interrupted by " + cause, addSeparator );
                    }
                };

            event.preventDefault();

            if ( chainData ) {

                chain = chainData.split( "|" );
                chain = $.map( chain, function ( stepData ) {
                    var coords = stepData.split( "," );
                    return { x: coords[0], y: coords[1] };
                } );

                $.each( chain, function ( index, position ) {
                    config.done = function () {
                        var isLastSubscroll = index === chain.length - 1;
                        updateLog( [ actionLabel, " (", index + 1, ") done for { x: ", position.x || "n/a", ", y: ", position.y || "n/a", " }." ], isLastSubscroll );
                    };

                    $window.scrollTo( position, config );
                } );

            } else {

                $window.scrollTo( {
                    x: $elem.data( "x" ),
                    y: $elem.data( "y" )
                }, config );

            }

        } );

        // Wire up the mode controls
        $modeControls.click( function ( event ) {
            var $elem = $ ( this );

            event.preventDefault();

            $modeControls.not( $elem ).removeClass( "active" ).addClass( "info" );
            $elem.addClass( "active" ).removeClass( "info" );
        } );

        $modeControls.filter( ".default" ).click();

        $window.scroll( _.throttle( updateFeedback, 100 ) );
        updateFeedback();

        function updateFeedback () {
            var posX = $window.scrollLeft(),
                posY = $window.scrollTop(),
                range = $window.scrollRange();

            $feedbackX_px.text( posX + "px" );
            $feedbackX_percent.text( toPercent( posX, range.horizontal, 4 ) + "%" );

            $feedbackY_px.text( posY + "px" );
            $feedbackY_percent.text( toPercent( posY, range.vertical, 4 ) + "%" );
        }

        function updateLog ( message, addSeparator, appendedMessageConsoleOnly ) {
            var $entry = $( "<li/>" );

            if ( $.isArray( message ) ) message = message.join( "" );

            if ( addSeparator ) $entry.addClass( "done" );
            $entry.text( message ).appendTo( $log );

            if ( typeof console !== "undefined" ) {
                if ( appendedMessageConsoleOnly ) message += appendedMessageConsoleOnly;
                console.log( message );
                if ( addSeparator ) console.log( "-------" );
            }
        }

        function getScrollMode () {
            return $modeControls.filter( ".active" ).data( "mode" );
        }

    } );

    function toPercent ( pos, scrollRange, decimals ) {
        var percentage = pos * 100 / scrollRange,
            shift = Math.pow( 10, decimals || 0 );

        return Math.round( percentage * shift ) / shift;
    }

    function getMeasuredDuration( entry, opts ) {
        var duration = performance.getEntriesByName( entry )[0].duration;
        if ( opts && opts.rounded ) duration = Math.round( duration );
        if ( opts && opts.unit ) duration = duration  + "ms";

        return duration;
    }

} );
