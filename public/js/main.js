$(function() {
    window.submitBtnController = function(form, opts) {
        var clicked = $(form).find("#clicked:submit").length ? "#clicked" : "";
        var $submitBtn = this.submitBtn = $(form).find(clicked+":submit").attr("disabled", true);
        var method = this.method = this.submitBtn.is(":button") ? "html" : "val";
        this.originalVal = this.submitBtn[method]();
        var progressVal = this.submitBtn[method](opts.progressMsg || "SUBMITTING")[method]();
        this.interval = !opts.ellipsis ? -1 : setInterval(function() {
            var val = $submitBtn[method]();
            var ellipsis = $submitBtn[method]().includes("...");
            $submitBtn[method](ellipsis ? progressVal : val + ".");
        }, 500);
    };
    submitBtnController.prototype.finish = function() {
        clearInterval(this.interval);
        this.submitBtn[this.method](this.originalVal).attr("disabled", false);
    };

    window.Flash = function($elm) {
        var closeable = $elm.find(".close-btn").length;
        $elm.slideDown(function() {
            !closeable && setTimeout(function() {
                $elm.slideUp(function() { $(this).remove() });
            }, 4000);
        });
    }

    window.Alert = function(message, closeable) {
        message = "<p>" + message.replace(/\r?\n/g, "</p><p>") + "</p>";
        var $closeBtn = $("<button>").addClass("close-btn btn").attr({ type: "button", "aria-label": "Close" }).html('<span class="fal fa-times"></span>');
        var $toast = $("<div>").addClass("site-toast global text-center").html(message).prepend(closeable ? $closeBtn : "");
        Flash($toast.appendTo(document.body));
    }

    var scrollToSection = function(sectionName, isHref) {
        var section_id = "#" + sectionName + "-section";
        if (!$(section_id).length) return !isHref || (location.href = "/" + sectionName);
        var aboveSection = window.scrollY < $(section_id).offset().top;
        var belowSection = window.scrollY > $(section_id).offset().top + parseFloat($(section_id).css("height")) - (window.innerHeight / 3);
        location.hash && (location.hash = "");
        (aboveSection || belowSection) && $("html, body").animate({ scrollTop: $(section_id).offset().top }, 700);
    }

    $("#nav-toggle").click(function() { $("#nav-section").toggleClass("show") });
    $("#nav-close").click(function() { $("#nav-section").removeClass("show") });

    $("#nav .link").click(function(e) {
        e.preventDefault();
        $("#nav-section").removeClass("show");
        scrollToSection($(this).attr("href").slice(1), true);
    });

    $(".section-dropdown-options select").change(function() {
        if (this.value && this.value.charAt(0) !== "#") location.href = this.value;
        $(".nav-pills a[href='"+ this.value +"']").click()
    });

    $(document).on("click", ".clear-uploads", function(e) {
        e.preventDefault();
        var $uploader = $(this).closest(".file-uploader");
        $uploader.find("input:file").val("").change();
    });

    $(document).on("change", ".file-uploader :file", function() {
        var files = this.files;
        var fieldname = this.dataset.fieldname;
        var $uploader = $(this).closest(".file-uploader");
        var $image_url = $uploader.find("input[type=url]").attr("disabled", false).val("").trigger("input");
        var $file_label = $uploader.find(".custom-file-label");
        var initial_label_value = $file_label.data("initial-value") || $file_label.text();
        $file_label.data("initial-value", initial_label_value).text(initial_label_value);
        $uploader.find("input:hidden").remove();
        if (!files || !files.length) return;
        $file_label.text("Loading...");
        var $submitInput = $(this).closest("form").find(":submit").attr("disabled", true);
        async.each(files, function(file, cb) {
            var reader = new FileReader();
            var $input = $("<input type='hidden' name='"+ fieldname +"'>").appendTo($uploader);
            reader.onerror = function() { cb((files.length > 1 ? "One or more images" : "Image") + " not found/valid") };
            reader.onload = function(e) {
                var media = e.target.result.includes("image") ? new Image() : document.createElement("video");
                media.onload = function() { $input.val(e.target.result); cb() };
                media.oncanplay = media.onload;
                media.onerror = reader.onerror;
                media.src = e.target.result;
            };
            reader.readAsDataURL(file)
        }, function(err) {
            if (err) {
                $file_label.text(initial_label_value);
                $uploader.find(".clear-uploads").click();
                return Alert(err.message || err, true)
            }
            var label_text = files[0].name + (files.length > 1 ? " + " + (files.length-1) + " more": "");
            $file_label.text(label_text);
            $image_url.attr("disabled", true).val(label_text);
            $submitInput.attr("disabled", false);
        });
    });

    $(document).on("input", ".file-uploader input[type=url]", function() {
        var $uploader = $(this).closest(".file-uploader");
        $uploader.find("input:file").prop("disabled", !!this.value.trim());
        $uploader.find("input:hidden").remove();

    }).on("click", ".file-uploader-options button.add", function() {
        var $uploader = $(this).closest(".file-uploader");
        var $newUploader = $uploader.clone(true);
        var inputFileID = $newUploader.find("input:file").attr("id").replace(/\-\-\d+$/, "");
        var $file_label = $newUploader.find(".custom-file-label");
        var initial_label_value = $file_label.data("initial-value");

        $newUploader.find("input:file").attr("id", inputFileID + "--" + Date.now());
        $newUploader.insertAfter($uploader).find(".clear-uploads").click();
        initial_label_value && $file_label.data("initial-value", initial_label_value);

    }).on("click", ".file-uploader-options button.remove", function() {
        var $container = $(this).closest(".file-upload-container");
        var moreThanOne = $container.find(".file-uploader").length > 1;
        moreThanOne && $(this).closest(".file-uploader").remove();
    });

    window.cookies = Object.fromEntries(document.cookie.split(/; */).map(function(c) {
        var a = c.split("=");
        return [decodeURIComponent(a[0]), decodeURIComponent(a[1])];
    }));

    $(window).on("load", function() {
        JSON.parse(cookies.active_tab_hrefs || "[]").forEach(function(href, i) {
            if (i == 0) $(".section-dropdown-options select:visible").val(href);
            $(".nav.nav-pills a[href='"+ href +"']").click();
        });

        $(".nav.nav-pills a").on("shown.bs.tab", function() {
            var $a = $(".nav.nav-pills:visible a.active[data-toggle=pill]");
            $a = $(".section-dropdown-options select:visible").add($a);
            $a = $("nav a.active[data-toggle=pill]").add($a);
            document.cookie = "active_tab_hrefs=" + JSON.stringify($a.map(function() { return $(this).attr("href") || $(this).val() }).get()) + "; path="+ location.pathname +";";
        });

        location.hash && scrollToSection(location.hash.slice(1));

        $("#home-page img").filter(function() { return !parseInt($(this).css("opacity")) }).each(function(i, e) {
            var image = new Image();
            image.onload = function() { $(e).delay(i * 800).fadeTo(800, 1) }
            image.src = e.src;
        });
    }).on("load scroll resize", function() {
        var belowUpperBound = window.scrollY > window.innerHeight / 2;
        var aboveLowerBound = window.scrollY + window.innerHeight < $("footer").offset().top;
        $("#to-top").toggleClass("show", belowUpperBound && aboveLowerBound);
        $("header").toggleClass("bg-opaque", belowUpperBound && $("header").css("position") == "fixed");
    });

    $("img[data-target='#image-lg-modal']").click(function() {
        $("#image-lg-modal .img").css("background-image", "url(" + $(this).attr("src") + ")");
    });

    $("#to-top").click(function() {
        $("html, body").animate({ scrollTop: 0 });
    });

    $(window).click(function() {
        if ($("#cart-icon:hover").length) {
            $(document.body).toggleClass("cart-open");
        } else if (!$(".cart-open").find("#cart-icon:hover, #cart-panel:hover").length) {
            $(document.body).removeClass("cart-open");
        }

        if (!$(".shop-product-item a:hover, .product-opts-toast:hover").length) {
            $(".product-opts-toast").slideUp();
        }
    });

    $(document).on("change", "#cart .product-quantity", function() {
        var $form = $(this).closest(".qty-change-form");
        $.post($form.attr("action"), $form.serializeArray(), function(res) {
            $("#cart-count").toggleClass("show", res.count > 0).text(res.count);
            $("#cart-panel").html(res.cartHtml);
        }).fail(function(err) {
            Alert(err.responseText);
        })
    });

    $(document).on("submit", "#cart .item-remove-form", function(e) {
        e.preventDefault();
        var $item = $(this).closest(".cart-item");
        $.post(this.action, $(this).serializeArray(), function(res) {
            $("#cart-count").toggleClass("show", res.count > 0).text(res.count);
            $item.slideUp(function() { $("#cart-panel").html(res.cartHtml) });
        }).fail(function(err) {
            Alert(err.responseText);
        })
    });

    var touchstartX = 0;
    var touchendX = 0;

    $(document).on('touchstart', function(e) {
        touchstartX = e.changedTouches[0].screenX;
    });

    $(document).on('touchend', function(e) {
        touchendX = e.changedTouches[0].screenX;

        var swipedRight = touchendX > touchstartX;
        var distanceX = Math.abs(touchendX - touchstartX);
        swipedRight && distanceX >= 80 && $(document.body).removeClass("cart-open");
    });

    $("#contact-form").submit(function(e) {
        e.preventDefault();
        var btnControl = new submitBtnController(this, { progressMsg: 'Sending', ellipsis: true });
        $.post(this.action, $(this).serializeArray(), function(res) {
            Alert(res);
        }).fail(function(err) {
            Alert(err.responseText);
        }).always(function() {
            btnControl.finish();
        });
    });

    $(".add-to-cart-form").submit(function(e) {
        e.preventDefault();
        var btnControl = new submitBtnController(this, { progressMsg: '<i class="fal fa-sync fa-spin"></i>' });
        $.post(this.action, $(this).serializeArray(), function(res) {
            $("#cart-count").toggleClass("show", res.count > 0).text(res.count);
            $("#cart-panel").html(res.cartHtml);
            Alert("Item added to cart!");
        }).fail(function(err) {
            Alert(err.responseText);
        }).always(function() {
            btnControl.finish();
        })
    }).find(".product-style").change(function(e) {
        var $form = $(e.target).closest("form");
        var $qtyField = $form.find(".product-quantity");
        $.post("/shop/product/get-price", $form.serializeArray(), function(res) {
            var priceFormatted = "£" + parseFloat(res.price).toFixed(2);
            var html = "<span class='small font-weight-light d-block d-sm-inline'>Unit price:</span>";
            html += " <span class='ml-sm-2' style='font-size: 1.2em'>" + priceFormatted + "</span>";

            html = $("#product-item-full").length ? "Unit price: <span>" + priceFormatted + "</span>" : html;
            $form.find(".price-calculated").html(res.price ? html : "");

            var currentValue = parseInt($qtyField.val());
            currentValue = Math.min(currentValue, res.stock_qty);
            $qtyField.html(Array.apply(null, Array(res.stock_qty)).map(function(e, i) {
                var selected = currentValue == i+1 ? "selected" : "";
                return `<option value="${i+1}" ${selected}>${i+1}</option>`
            }));
        }).fail(function(err) {
            $form.find(".price-calculated").html("");
            $qtyField.html('<option value="1">1</option>');
            err.responseText && Alert(err.responseText);
        })
    });

    $(".shop-product-item .toast-toggle").click(function(e) {
        e.preventDefault();
        $(".product-opts-toast").slideUp();
        $(this).closest(".shop-product-item").find(".product-opts-toast").stop().slideToggle();
    });

    $(document).on("click", ".site-toast .close-btn", function() {
        $(this).closest(".site-toast").slideUp(function() {
            $(this).is(".global") && $(this).remove();
        });
    });

    var transitionEndEvents = "transitionEnd oTransitionEnd msTransitionEnd transitionend webkitTransitionEnd";
    $("#cart-panel").on(transitionEndEvents, function() {
        var isTouchScreen = "ontouchstart" in window && (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0);
        var cartPanelOpen = $(".cart-open").length;
        var $swipeInfo = $("<p>").addClass("flash-message").text("Swipe right to close");
        if (!isTouchScreen || !cartPanelOpen) return;
        Flash($swipeInfo.prependTo("#cart-info-box"));
        $(this).off(transitionEndEvents);
    });

    $("#social-links .simple-icon").on("error", function() { $(this).remove() });
});
